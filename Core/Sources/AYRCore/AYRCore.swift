import Foundation

public enum Identity: String, CaseIterable, Codable, Sendable {
    case student, jobSeeker, worker

    public var title: String {
        switch self {
        case .student: "학생"
        case .jobSeeker: "취준생"
        case .worker: "직장인"
        }
    }

    /// 신분별 하루 기준 금액 기본값(원). 사용자가 온보딩·설정에서 바꿀 수 있다.
    public var defaultBudget: Int {
        switch self {
        case .student: 20_000
        case .jobSeeker: 30_000
        case .worker: 50_000
        }
    }
}

public let maximumMoney = Int.max / 366

/// 50% 미만 / 100% 미만 / 그 이상. 곱셈 없이 홀수 기준 금액도 정확하게 비교한다.
public func phrase(total: Int, budget: Int) -> String {
    if total < budget / 2 + budget % 2 { return "아직 여유 있어요" }
    if total < budget { return "슬슬 조절해볼까요?" }
    return "님 부자임?"
}

public func banner(total: Int, budget: Int) -> String {
    "오늘 \(won(total))원 · \(phrase(total: total, budget: budget))"
}

public struct AppSettings: Codable, Equatable, Sendable {
    public var identity: Identity
    public let dailyBudget: Int
    public var sources: Set<PaymentSource>

    /// 기준 금액은 원 단위 양의 정수만 받는다.
    public init?(identity: Identity, dailyBudget: Int? = nil, sources: Set<PaymentSource> = []) {
        let budget = dailyBudget ?? identity.defaultBudget
        guard budget > 0, budget <= maximumMoney else { return nil }
        self.identity = identity
        self.dailyBudget = budget
        self.sources = sources
    }

    private enum CodingKeys: String, CodingKey { case identity, dailyBudget, sources }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        guard let settings = AppSettings(
            identity: try values.decode(Identity.self, forKey: .identity),
            dailyBudget: try values.decode(Int.self, forKey: .dailyBudget),
            sources: try values.decode(Set<PaymentSource>.self, forKey: .sources)
        ) else { throw LedgerError.invalidStoredData }
        self = settings
    }

    /// 선택한 수단 중 지원되는 것만 해석에 쓴다. 테스트 표식이 있으면 합산하지 않는 `.test`.
    public func parse(_ text: String) -> PaymentEvent? {
        if text.contains(PaymentSource.testMarker) { return .test }
        for source in PaymentSource.allCases where sources.contains(source) && source.isSupported {
            if let event = source.parse(text) { return event }
        }
        return nil
    }
}

public enum PaymentEvent: Equatable, Sendable {
    case approval(Int)
    case cancellation(Int)
    /// 자동화 수신 테스트. 합산하지 않는다.
    case test
}

/// 결제 수단 + 수신 경로. 수단마다 경로를 하나로 정해 같은 결제를 두 번 합산하지 않는다.
public enum PaymentSource: String, CaseIterable, Codable, Sendable {
    case kbCheckSMS
    case tossNotification

    public static let testMarker = "AYR테스트"

    public var title: String {
        switch self {
        case .kbCheckSMS: "KB국민 체크카드 · 문자"
        case .tossNotification: "토스뱅크 체크카드·토스페이 · 토스 알림"
        }
    }

    /// 실제 형식을 확인한 수단만 선택할 수 있다.
    public var isSupported: Bool { self == .kbCheckSMS }

    /// 자동화 트리거에 거는 '포함' 필터 문구. 없으면 nil.
    public var filterKeyword: String? {
        switch self {
        case .kbCheckSMS: "KB국민체크"
        case .tossNotification: nil
        }
    }

    /// 자기 자신에게 보내 자동화를 시험하는 문구. 트리거 필터를 통과하고 합산되지 않는다.
    public var testMessage: String {
        [filterKeyword, Self.testMarker].compactMap { $0 }.joined(separator: " ")
    }

    public func parse(_ text: String) -> PaymentEvent? {
        switch self {
        case .kbCheckSMS: parseKBMessage(text)
        case .tossNotification: nil
        }
    }
}

/// 하루치 승인 금액. 알림 원문은 저장하지 않는다.
public struct DailySpending: Codable, Equatable, Sendable {
    /// 기기 현지 날짜 `yyyy-MM-dd`.
    public private(set) var day: String
    public private(set) var approvals: [Int]
    public private(set) var carriedTotal: Int

    public init(day: String, approvals: [Int] = [], carriedTotal: Int = 0) {
        precondition(validDayKey(day) && validAmounts(approvals, carriedTotal: carriedTotal))
        self.day = day
        self.approvals = approvals
        self.carriedTotal = carriedTotal
    }

    private enum CodingKeys: String, CodingKey { case day, approvals, carriedTotal }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let day = try values.decode(String.self, forKey: .day)
        let approvals = try values.decode([Int].self, forKey: .approvals)
        let carriedTotal = try values.decodeIfPresent(Int.self, forKey: .carriedTotal) ?? 0
        guard validDayKey(day), validAmounts(approvals, carriedTotal: carriedTotal) else { throw LedgerError.invalidStoredData }
        self.day = day
        self.approvals = approvals
        self.carriedTotal = carriedTotal
    }

    public var total: Int { approvals.reduce(carriedTotal, +) }

    /// 날짜가 바뀌었으면 빈 기록을 돌려준다.
    public func rolled(to day: String) -> DailySpending {
        day == self.day ? self : DailySpending(day: day)
    }

    /// 반영했으면 true. 0원 이하는 거부하고, 취소는 오늘 같은 금액의 승인이 있을 때만 1건 차감한다.
    /// 알림에는 원거래 정보가 없어 전날 결제·부분 취소는 차감하지 않는다.
    @discardableResult
    public mutating func apply(_ event: PaymentEvent) -> Bool {
        switch event {
        case .approval(let amount):
            guard amount > 0, amount <= maximumMoney - total else { return false }
            approvals.append(amount)
            return true
        case .cancellation(let amount):
            guard amount > 0, let index = approvals.lastIndex(of: amount) else { return false }
            approvals.remove(at: index)
            return true
        case .test:
            return false
        }
    }

    mutating func removeApproval(at index: Int) -> Bool {
        guard approvals.indices.contains(index) else { return false }
        approvals.remove(at: index)
        return true
    }
}

private func validAmounts(_ amounts: [Int], carriedTotal: Int) -> Bool {
    guard carriedTotal >= 0, carriedTotal <= maximumMoney else { return false }
    var total = carriedTotal
    for amount in amounts {
        guard amount > 0, amount <= maximumMoney - total else { return false }
        total += amount
    }
    return true
}

/// KB국민 결제 문자를 해석한다. 확인된 형식은 체크카드 승인뿐이며(2026-11-03), 그 외는 nil.
/// ```
/// [Web발신]
/// KB국민체크(1234)
/// 홍*동님
/// 11/03 19:46
/// 5,100원
/// 가게이름 사용
/// ```
public func parseKBMessage(_ text: String) -> PaymentEvent? {
    let lines = text.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }
    guard lines.contains(where: { $0.hasPrefix("KB국민체크") }),
          lines.last?.hasSuffix(" 사용") == true else { return nil }
    let amounts = lines.compactMap(wonAmount)
    guard amounts.count == 1 else { return nil }
    return .approval(amounts[0])
}

/// `5,100원`처럼 금액만 있는 줄. 0원 이하는 nil.
func wonAmount(_ line: String) -> Int? {
    guard line.hasSuffix("원") else { return nil }
    let digits = line.dropLast().replacingOccurrences(of: ",", with: "")
    guard !digits.isEmpty, digits.allSatisfy({ $0.isASCII && $0.isNumber }),
          let amount = Int(digits), amount > 0 else { return nil }
    return amount
}

/// 날짜 기록은 기기 시간대를 따르되 사용자가 선택한 달력과 무관하게 양력으로 저장한다.
public func spendingCalendar(timeZone: TimeZone = .current) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
}

public func dayKey(for date: Date, calendar: Calendar = spendingCalendar()) -> String {
    let calendar = spendingCalendar(timeZone: calendar.timeZone)
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
}

func won(_ amount: Int) -> String {
    amount.formatted(.number.locale(Locale(identifier: "en_US")))
}
