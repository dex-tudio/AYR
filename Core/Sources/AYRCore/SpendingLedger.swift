import Foundation

public enum LedgerError: Error, LocalizedError {
    case invalidAmount, amountOverflow, notConfigured, invalidStoredData

    public var errorDescription: String? {
        switch self {
        case .invalidAmount: "금액은 허용 범위 안의 양의 정수로 입력해주세요."
        case .amountOverflow: "집계할 수 있는 금액 범위를 초과했습니다."
        case .notConfigured: "앱에서 초기 설정을 먼저 완료해주세요."
        case .invalidStoredData: "저장된 기록을 읽을 수 없습니다. 기존 파일은 보존됩니다."
        }
    }
}

public struct DailyRecord: Codable, Equatable, Sendable {
    public let total: Int
    public let budget: Int

    public init(total: Int, budget: Int) {
        precondition(total >= 0 && total <= maximumMoney && budget > 0 && budget <= maximumMoney)
        self.total = total
        self.budget = budget
    }

    private enum CodingKeys: String, CodingKey { case total, budget }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let total = try values.decode(Int.self, forKey: .total)
        let budget = try values.decode(Int.self, forKey: .budget)
        guard total >= 0, total <= maximumMoney, budget > 0, budget <= maximumMoney else {
            throw LedgerError.invalidStoredData
        }
        self.total = total
        self.budget = budget
    }
}

public struct MonthDay: Identifiable, Equatable, Sendable {
    public var id: String { key }
    public let date: Date
    public let key: String
    public let total: Int?
    public let budget: Int?
}

public struct MonthSummary: Equatable, Sendable {
    public let days: [MonthDay]
    public let total: Int
    public let budget: Int
    public var remaining: Int { budget - total }
    /// 이전 달의 비교 기간 전체가 기록된 경우에만 제공한다.
    public let comparison: Int?
    public let phraseCounts: [String: Int]
}

public struct SpendingLedger: Codable, Equatable, Sendable {
    public private(set) var settings: AppSettings
    public private(set) var firstDay: String?
    public private(set) var current: DailySpending
    public private(set) var records: [String: DailyRecord]
    public private(set) var monthlyBudget: Int?
    public private(set) var onboardingCompleted: Bool
    public private(set) var lastReception: Date?

    public init(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        settings = AppSettings(identity: .student, sources: [.kbCheckSMS])!
        current = DailySpending(day: dayKey(for: now, calendar: calendar))
        records = [:]
        onboardingCompleted = false
    }

    public mutating func refresh(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        let calendar = spendingCalendar(timeZone: calendar.timeZone)
        let today = dayKey(for: now, calendar: calendar)
        let month = calendar.dateInterval(of: .month, for: now)!.start
        let cutoff = dayKey(for: calendar.date(byAdding: .month, value: -11, to: month)!, calendar: calendar)
        rollCurrentDay(to: today)
        records = records.filter { $0.key >= cutoff }
        guard onboardingCompleted, let firstDay else { return }
        let start = max(firstDay, cutoff)
        guard let date = dateFromKey(start, calendar: calendar), start <= today else { return }
        fillMissingDays(from: date, through: today, calendar: calendar)
        records[today] = DailyRecord(total: current.total, budget: settings.dailyBudget)
    }

    private mutating func rollCurrentDay(to today: String) {
        guard current.day != today else { return }
        if onboardingCompleted {
            records[current.day] = DailyRecord(total: current.total,
                budget: records[current.day]?.budget ?? settings.dailyBudget)
        }
        // shortcut: 날짜를 되돌리면 접힌 합계만 복원하므로 개별 취소 대조는 불가, 거래 ID가 생기면 대체.
        let restored = records[today]?.total ?? 0
        current = DailySpending(day: today, approvals: restored > 0 ? [restored] : [])
    }

    private mutating func fillMissingDays(from start: Date, through today: String, calendar: Calendar) {
        var date = start
        var budget = records[dayKey(for: start, calendar: calendar)]?.budget ?? settings.dailyBudget
        while dayKey(for: date, calendar: calendar) <= today {
            let key = dayKey(for: date, calendar: calendar)
            if let record = records[key] { budget = record.budget }
            else { records[key] = DailyRecord(total: 0, budget: budget) }
            date = calendar.date(byAdding: .day, value: 1, to: date)!
        }
    }

    public mutating func completeOnboarding(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        if !onboardingCompleted {
            firstDay = dayKey(for: now, calendar: calendar)
            onboardingCompleted = true
        }
        refresh(now: now, calendar: calendar)
    }

    public mutating func updateSettings(_ settings: AppSettings, monthlyBudget: Int?,
                                       now: Date = Date(), calendar: Calendar = spendingCalendar()) throws {
        if let monthlyBudget, !(1...maximumMoney).contains(monthlyBudget) { throw LedgerError.invalidAmount }
        refresh(now: now, calendar: calendar)
        self.settings = settings
        self.monthlyBudget = monthlyBudget
        refresh(now: now, calendar: calendar)
    }

    @discardableResult
    public mutating func receive(_ text: String, now: Date = Date(), calendar: Calendar = spendingCalendar()) throws -> Bool {
        refresh(now: now, calendar: calendar)
        guard let event = settings.parse(text) else { return false }
        if event == .test {
            lastReception = now
            return false
        }
        guard onboardingCompleted else { throw LedgerError.notConfigured }
        if case .approval(let amount) = event, amount > maximumMoney - current.total {
            throw LedgerError.amountOverflow
        }
        let changed = current.apply(event)
        if changed {
            lastReception = now
            records[current.day] = DailyRecord(total: current.total, budget: settings.dailyBudget)
        }
        return changed
    }

    public func summary(for month: Date, now: Date = Date(), calendar: Calendar = spendingCalendar()) -> MonthSummary {
        let calendar = spendingCalendar(timeZone: calendar.timeZone)
        var ledger = self
        ledger.refresh(now: now, calendar: calendar)
        let start = calendar.dateInterval(of: .month, for: month)!.start
        let count = calendar.range(of: .day, in: .month, for: start)!.count
        let today = dayKey(for: now, calendar: calendar)
        let days = (0..<count).map { offset -> MonthDay in
            let date = calendar.date(byAdding: .day, value: offset, to: start)!
            let key = dayKey(for: date, calendar: calendar)
            let record = key <= today ? ledger.records[key] : nil
            return MonthDay(date: date, key: key, total: record?.total, budget: record?.budget)
        }
        let total = days.compactMap(\.total).reduce(0, +)
        var phraseCounts: [String: Int] = [:]
        for day in days {
            if let amount = day.total, let budget = day.budget {
                phraseCounts[phrase(total: amount, budget: budget), default: 0] += 1
            }
        }
        let comparison = ledger.previousMonthDifference(for: days, total: total, now: now, calendar: calendar)
        return MonthSummary(days: days, total: total, budget: monthlyBudget ?? settings.dailyBudget * count,
                            comparison: comparison, phraseCounts: phraseCounts)
    }

    private func previousMonthDifference(for days: [MonthDay], total: Int, now: Date, calendar: Calendar) -> Int? {
        let start = days[0].date
        let periodCount = calendar.isDate(start, equalTo: now, toGranularity: .month)
            ? calendar.component(.day, from: now) : days.count
        let previous = calendar.date(byAdding: .month, value: -1, to: start)!
        let previousCount = min(periodCount, calendar.range(of: .day, in: .month, for: previous)!.count)
        let previousRecords = (0..<previousCount).map { offset in
            records[dayKey(for: calendar.date(byAdding: .day, value: offset, to: previous)!, calendar: calendar)]
        }
        let covered = days.prefix(periodCount).allSatisfy { $0.total != nil }
            && previousRecords.allSatisfy { $0 != nil }
        return covered ? total - previousRecords.compactMap { $0?.total }.reduce(0, +) : nil
    }

    private enum CodingKeys: String, CodingKey {
        case settings, firstDay, current, records, monthlyBudget, onboardingCompleted, lastReception
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        settings = try values.decode(AppSettings.self, forKey: .settings)
        firstDay = try values.decodeIfPresent(String.self, forKey: .firstDay)
        current = try values.decode(DailySpending.self, forKey: .current)
        records = try values.decode([String: DailyRecord].self, forKey: .records)
        monthlyBudget = try values.decodeIfPresent(Int.self, forKey: .monthlyBudget)
        onboardingCompleted = try values.decode(Bool.self, forKey: .onboardingCompleted)
        lastReception = try values.decodeIfPresent(Date.self, forKey: .lastReception)
        guard records.keys.allSatisfy(validDayKey),
              firstDay.map(validDayKey) ?? !onboardingCompleted,
              !onboardingCompleted || firstDay != nil,
              monthlyBudget.map({ (1...maximumMoney).contains($0) }) ?? true,
              records[current.day].map({ $0.total == current.total }) ?? true else {
            throw LedgerError.invalidStoredData
        }
    }
}

func dateFromKey(_ key: String, calendar: Calendar) -> Date? {
    let calendar = spendingCalendar(timeZone: calendar.timeZone)
    let pieces = key.split(separator: "-").compactMap { Int($0) }
    guard pieces.count == 3, key.count == 10,
          let date = calendar.date(from: DateComponents(year: pieces[0], month: pieces[1], day: pieces[2])),
          dayKey(for: date, calendar: calendar) == key else { return nil }
    return date
}

func validDayKey(_ key: String) -> Bool {
    dateFromKey(key, calendar: Calendar(identifier: .gregorian)) != nil
}
