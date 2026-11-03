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

    /// 하루 기준 금액(원).
    public var dailyBudget: Int {
        switch self {
        case .student: 20_000
        case .jobSeeker: 30_000
        case .worker: 50_000
        }
    }

    /// 50% 미만 / 100% 미만 / 그 이상. 소수 없이 비교하려고 합계에 2를 곱한다.
    public func phrase(for total: Int) -> String {
        if total * 2 < dailyBudget { return "아직 여유 있어요" }
        if total < dailyBudget { return "슬슬 조절해볼까요?" }
        return "님 부자임?"
    }

    public func banner(for total: Int) -> String {
        "오늘 \(won(total))원 · \(phrase(for: total))"
    }
}

public enum PaymentEvent: Equatable, Sendable {
    case approval(Int)
    case cancellation(Int)
}

/// 하루치 승인 금액. 알림 원문은 저장하지 않는다.
public struct DailySpending: Codable, Equatable, Sendable {
    /// 기기 현지 날짜 `yyyy-MM-dd`.
    public private(set) var day: String
    public private(set) var approvals: [Int]

    public init(day: String, approvals: [Int] = []) {
        self.day = day
        self.approvals = approvals
    }

    public var total: Int { approvals.reduce(0, +) }

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
            guard amount > 0 else { return false }
            approvals.append(amount)
            return true
        case .cancellation(let amount):
            guard amount > 0, let index = approvals.lastIndex(of: amount) else { return false }
            approvals.remove(at: index)
            return true
        }
    }
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

public func dayKey(for date: Date, calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
}

func won(_ amount: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.groupingSeparator = ","
    formatter.usesGroupingSeparator = true
    return formatter.string(from: NSNumber(value: amount))!
}
