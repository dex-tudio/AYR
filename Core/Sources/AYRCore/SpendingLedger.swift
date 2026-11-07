import Foundation

public enum LedgerError: Error, LocalizedError {
    case invalidAmount, amountOverflow, notConfigured, invalidStoredData, dayChanged, spendingChanged

    public var errorDescription: String? {
        switch self {
        case .invalidAmount: "금액은 1원 이상, 입력 가능한 범위 안에서 숫자로만 적어주세요."
        case .amountOverflow: "기록할 수 있는 최대 금액을 넘었어요."
        case .notConfigured: "앱에서 시작하기를 먼저 마쳐주세요."
        case .invalidStoredData: "저장된 기록을 읽지 못했어요. 기존 기록은 그대로 두었어요."
        case .dayChanged: "날짜가 바뀌었어요. 오늘 기록을 확인한 뒤 다시 시도해주세요."
        case .spendingChanged: "지출 목록이 바뀌었어요. 최신 기록을 확인한 뒤 다시 선택해주세요."
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
    public private(set) var monthBudgets: [String: Int]
    public private(set) var onboardingCompleted: Bool
    public private(set) var lastReception: Date?
    public private(set) var lastAttempt: ReceptionAttempt?
    private var restoredDayBudget: Int?

    public var currentBudget: Int { restoredDayBudget ?? settings.dailyBudget }

    public init(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        settings = AppSettings(identity: .student, sources: [.kbCheckSMS])!
        current = DailySpending(day: dayKey(for: now, calendar: calendar))
        records = [:]
        monthBudgets = [:]
        onboardingCompleted = false
    }

    public mutating func refresh(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        let calendar = spendingCalendar(timeZone: calendar.timeZone)
        let today = dayKey(for: now, calendar: calendar)
        let month = calendar.dateInterval(of: .month, for: now)!.start
        let cutoff = dayKey(for: calendar.date(byAdding: .month, value: -11, to: month)!, calendar: calendar)
        rollCurrentDay(to: today)
        records = records.filter { $0.key >= cutoff }
        monthBudgets = monthBudgets.filter { $0.key >= String(cutoff.prefix(7)) }
        guard onboardingCompleted, let firstDay else { return }
        let start = max(firstDay, cutoff)
        if let date = dateFromKey(start, calendar: calendar), start <= today {
            fillMissingDays(from: date, through: today, calendar: calendar)
            recordCurrentDay()
        }
        fillMonthBudgets(through: now, cutoff: cutoff, calendar: calendar)
    }

    private mutating func rollCurrentDay(to today: String) {
        guard current.day != today else { return }
        if onboardingCompleted, let firstDay,
           current.day >= firstDay || records[current.day] != nil || current.total > 0 {
            recordCurrentDay()
        }
        let restored = records[today]
        current = DailySpending(day: today, carriedTotal: restored?.total ?? 0)
        restoredDayBudget = restored?.budget
    }

    private mutating func recordCurrentDay() {
        records[current.day] = DailyRecord(total: current.total, budget: currentBudget)
        let key = String(current.day.prefix(7))
        if monthBudgets[key] == nil {
            let calendar = spendingCalendar()
            let month = dateFromKey(key + "-01", calendar: calendar)!
            monthBudgets[key] = inferredMonthBudget(for: month, calendar: calendar)
        }
    }

    private mutating func fillMonthBudgets(through now: Date, cutoff: String, calendar: Calendar) {
        guard let firstDay else { return }
        let firstRecord = min(firstDay, records.keys.min() ?? firstDay)
        let start = max(String(firstRecord.prefix(7)), String(cutoff.prefix(7)))
        let end = String(dayKey(for: now, calendar: calendar).prefix(7))
        guard var month = dateFromKey(start + "-01", calendar: calendar), start <= end else { return }
        while String(dayKey(for: month, calendar: calendar).prefix(7)) <= end {
            let key = String(dayKey(for: month, calendar: calendar).prefix(7))
            if monthBudgets[key] == nil { monthBudgets[key] = inferredMonthBudget(for: month, calendar: calendar) }
            month = calendar.date(byAdding: .month, value: 1, to: month)!
        }
    }

    private func inferredMonthBudget(for month: Date, calendar: Calendar) -> Int {
        if let monthlyBudget { return monthlyBudget }
        let key = String(dayKey(for: month, calendar: calendar).prefix(7))
        let first = records.keys.filter { $0.hasPrefix(key + "-") }.min()
        let latestMonth = String((records.keys.max() ?? current.day).prefix(7))
        let dailyBudget = key >= latestMonth ? settings.dailyBudget : first.flatMap { records[$0]?.budget } ?? settings.dailyBudget
        return dailyBudget * calendar.range(of: .day, in: .month, for: month)!.count
    }

    private mutating func fillMissingDays(from start: Date, through today: String, calendar: Calendar) {
        var date = start
        let latestRecordedDay = records.keys.max() ?? dayKey(for: start, calendar: calendar)
        var budget = records[dayKey(for: start, calendar: calendar)]?.budget ?? settings.dailyBudget
        while dayKey(for: date, calendar: calendar) <= today {
            let key = dayKey(for: date, calendar: calendar)
            if let record = records[key] { budget = record.budget }
            else {
                if key > latestRecordedDay { budget = settings.dailyBudget }
                records[key] = DailyRecord(total: 0, budget: budget)
            }
            date = calendar.date(byAdding: .day, value: 1, to: date)!
        }
    }

    public mutating func completeOnboarding(now: Date = Date(), calendar: Calendar = spendingCalendar()) {
        refresh(now: now, calendar: calendar)
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
        let month = String(current.day.prefix(7))
        let isArchivedMonth = monthBudgets.keys.contains { $0 > month }
        self.settings = settings
        self.monthlyBudget = monthlyBudget
        if onboardingCompleted, !isArchivedMonth {
            let calendar = spendingCalendar(timeZone: calendar.timeZone)
            let days = calendar.range(of: .day, in: .month, for: now)!.count
            monthBudgets[month] = monthlyBudget ?? settings.dailyBudget * days
        }
        refresh(now: now, calendar: calendar)
    }

    @discardableResult
    public mutating func receive(_ text: String, now: Date = Date(), calendar: Calendar = spendingCalendar()) throws -> Bool {
        refresh(now: now, calendar: calendar)
        let event = settings.parse(text)
        if event == .test {
            lastReception = now
            lastAttempt = ReceptionAttempt(date: now, status: .test)
            return false
        }
        guard onboardingCompleted else {
            lastAttempt = ReceptionAttempt(date: now, status: .notConfigured)
            throw LedgerError.notConfigured
        }
        guard let event else {
            lastAttempt = ReceptionAttempt(date: now, status: .ignored)
            return false
        }
        if case .approval(let amount) = event, amount > maximumMoney - current.total {
            lastAttempt = ReceptionAttempt(date: now, status: .overflow)
            throw LedgerError.amountOverflow
        }
        let changed = current.apply(event)
        lastAttempt = ReceptionAttempt(date: now, status: changed ? .success : .ignored)
        if changed {
            lastReception = now
            recordCurrentDay()
        }
        return changed
    }

    public mutating func addSpending(_ amount: Int, expectedDay: String,
                                     now: Date = Date(), calendar: Calendar = spendingCalendar()) throws {
        refresh(now: now, calendar: calendar)
        guard onboardingCompleted else { throw LedgerError.notConfigured }
        guard expectedDay == current.day else { throw LedgerError.dayChanged }
        guard amount > 0, amount <= maximumMoney else { throw LedgerError.invalidAmount }
        guard current.apply(.approval(amount)) else { throw LedgerError.amountOverflow }
        recordCurrentDay()
    }

    public mutating func removeSpending(at index: Int, expected: DailySpending,
                                        now: Date = Date(), calendar: Calendar = spendingCalendar()) throws {
        refresh(now: now, calendar: calendar)
        guard onboardingCompleted else { throw LedgerError.notConfigured }
        guard expected.day == current.day else { throw LedgerError.dayChanged }
        guard expected == current, current.removeApproval(at: index) else { throw LedgerError.spendingChanged }
        recordCurrentDay()
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
        let monthKey = String(dayKey(for: start, calendar: calendar).prefix(7))
        let budget = ledger.monthBudgets[monthKey] ?? ledger.inferredMonthBudget(for: start, calendar: calendar)
        return MonthSummary(days: days, total: total, budget: budget,
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
        case settings, firstDay, current, records, monthlyBudget, monthBudgets, onboardingCompleted, lastReception, lastAttempt, restoredDayBudget
    }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        settings = try values.decode(AppSettings.self, forKey: .settings)
        firstDay = try values.decodeIfPresent(String.self, forKey: .firstDay)
        current = try values.decode(DailySpending.self, forKey: .current)
        records = try values.decode([String: DailyRecord].self, forKey: .records)
        monthlyBudget = try values.decodeIfPresent(Int.self, forKey: .monthlyBudget)
        monthBudgets = try values.decodeIfPresent([String: Int].self, forKey: .monthBudgets) ?? [:]
        onboardingCompleted = try values.decode(Bool.self, forKey: .onboardingCompleted)
        lastReception = try values.decodeIfPresent(Date.self, forKey: .lastReception)
        lastAttempt = try values.decodeIfPresent(ReceptionAttempt.self, forKey: .lastAttempt)
        restoredDayBudget = try values.decodeIfPresent(Int.self, forKey: .restoredDayBudget)
        guard records.keys.allSatisfy(validDayKey),
              firstDay.map(validDayKey) ?? !onboardingCompleted,
              !onboardingCompleted || firstDay != nil,
              monthlyBudget.map({ (1...maximumMoney).contains($0) }) ?? true,
              restoredDayBudget.map({ (1...maximumMoney).contains($0) }) ?? true,
              restoredDayBudget.map({ records[current.day]?.budget == $0 }) ?? true,
              monthBudgets.allSatisfy({ key, amount in
                  key.count == 7 && validDayKey(key + "-01") && amount > 0 && amount <= maximumMoney * 31
              }),
              records[current.day].map({ $0.total == current.total }) ?? true else {
            throw LedgerError.invalidStoredData
        }
        // shortcut: 이전 버전은 월 예산 이력이 없어 당시 직접 입력값은 복원 불가, 저장된 최신 예산·날짜별 기준으로 추정.
        let calendar = spendingCalendar()
        for day in records.keys.sorted() {
            let key = String(day.prefix(7))
            if monthBudgets[key] == nil, let month = dateFromKey(key + "-01", calendar: calendar) {
                monthBudgets[key] = inferredMonthBudget(for: month, calendar: calendar)
            }
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
