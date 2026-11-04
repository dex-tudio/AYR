import Foundation
import XCTest
@testable import AYRCore

final class SpendingLedgerTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        return calendar
    }

    private func date(_ key: String) -> Date { dateFromKey(key, calendar: calendar)! }

    private func message(_ amount: Int) -> String {
        "[Web발신]\nKB국민체크(1234)\n가*명님\n11/03 19:46\n\(amount)원\n가짜가게 사용"
    }

    func testOnboardingStartsHistoryAndTestReceptionDoesNotAddMoney() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        XCTAssertNil(ledger.firstDay)
        XCTAssertThrowsError(try ledger.receive(message(100), now: now, calendar: calendar))
        XCTAssertFalse(try ledger.receive("KB국민체크 AYR테스트", now: now, calendar: calendar))
        XCTAssertEqual(ledger.lastReception, now)
        XCTAssertEqual(ledger.current.total, 0)
        ledger.completeOnboarding(now: now, calendar: calendar)
        let summary = ledger.summary(for: now, now: now, calendar: calendar)
        XCTAssertEqual(summary.days[3].total, 0)
        XCTAssertNil(summary.days[2].total)
        XCTAssertNil(summary.days[4].total)
        XCTAssertEqual(summary.phraseCounts["아직 여유 있어요"], 1)
    }

    func testRolloverFoldsApprovalsAndFillsSkippedDaysWithHistoricBudget() throws {
        let start = date("2026-11-01")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        XCTAssertTrue(try ledger.receive(message(12_000), now: start, calendar: calendar))
        let later = date("2026-11-04")
        try ledger.updateSettings(AppSettings(identity: .worker, dailyBudget: 30_000, sources: [.kbCheckSMS])!,
                                  monthlyBudget: nil, now: later, calendar: calendar)
        XCTAssertEqual(ledger.current.approvals, [])
        XCTAssertEqual(ledger.records["2026-11-01"], DailyRecord(total: 12_000, budget: 20_000))
        XCTAssertEqual(ledger.records["2026-11-03"], DailyRecord(total: 0, budget: 20_000))
        XCTAssertEqual(ledger.records["2026-11-04"], DailyRecord(total: 0, budget: 30_000))
        let summary = ledger.summary(for: start, now: later, calendar: calendar)
        XCTAssertEqual(summary.total, 12_000)
        XCTAssertEqual(summary.phraseCounts["슬슬 조절해볼까요?"], 1)
        XCTAssertEqual(summary.phraseCounts["아직 여유 있어요"], 3)
    }

    func testSettingChangeRephrasesTodayWithoutChangingMoneyOrPastBudget() throws {
        let start = date("2026-11-01")
        let next = date("2026-11-02")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(12_000), now: start, calendar: calendar)
        try ledger.receive(message(12_000), now: next, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, dailyBudget: 50_000, sources: [.kbCheckSMS])!,
                                  monthlyBudget: 10_000, now: next, calendar: calendar)
        let summary = ledger.summary(for: next, now: next, calendar: calendar)
        XCTAssertEqual(ledger.current.total, 12_000)
        XCTAssertEqual(ledger.records["2026-11-01"]?.budget, 20_000)
        XCTAssertEqual(summary.budget, 10_000)
        XCTAssertEqual(summary.remaining, -14_000)
        XCTAssertEqual(summary.phraseCounts["아직 여유 있어요"], 1)
        XCTAssertEqual(summary.phraseCounts["슬슬 조절해볼까요?"], 1)
    }

    func testLeapMonthDefaultBudgetAndMarchComparisonClampToFebruaryEnd() throws {
        let start = date("2024-02-01")
        let now = date("2024-03-31")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(7_000), now: date("2024-02-29"), calendar: calendar)
        try ledger.receive(message(9_000), now: now, calendar: calendar)
        let february = ledger.summary(for: start, now: now, calendar: calendar)
        XCTAssertEqual(february.days.count, 29)
        XCTAssertEqual(february.budget, 580_000)
        XCTAssertEqual(ledger.summary(for: now, now: now, calendar: calendar).comparison, 2_000)
    }

    func testComparisonUsesSamePeriodAndRequiresCoverage() throws {
        let start = date("2026-10-01")
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(7_000), now: date("2026-10-04"), calendar: calendar)
        try ledger.receive(message(100_000), now: date("2026-10-05"), calendar: calendar)
        try ledger.receive(message(9_000), now: now, calendar: calendar)
        XCTAssertEqual(ledger.summary(for: now, now: now, calendar: calendar).comparison, 2_000)
        XCTAssertNil(ledger.summary(for: start, now: now, calendar: calendar).comparison)
    }

    func testRetainsCurrentMonthAndElevenPreviousMonthsOnly() throws {
        let start = date("2025-10-01")
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(7_000), now: start, calendar: calendar)
        ledger.refresh(now: now, calendar: calendar)
        XCTAssertEqual(ledger.records.keys.min(), "2025-12-01")
        XCTAssertEqual(ledger.records["2025-12-01"]?.total, 0)
        XCTAssertEqual(ledger.firstDay, "2025-10-01")
        XCTAssertNil(ledger.summary(for: start, now: now, calendar: calendar).days[0].total)
    }

    func testReceiveAndSettingsRejectOverflowWithoutChangingMoney() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.receive(message(maximumMoney), now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.receive(message(1), now: now, calendar: calendar))
        XCTAssertEqual(ledger.current.total, maximumMoney)
        XCTAssertThrowsError(try ledger.updateSettings(ledger.settings, monthlyBudget: 0, now: now, calendar: calendar))
        XCTAssertNil(ledger.monthlyBudget)
        XCTAssertNil(AppSettings(identity: .student, dailyBudget: Int.max))
        XCTAssertEqual(phrase(total: Int.max, budget: Int.max), "님 부자임?")
        _ = ledger.summary(for: now, now: now, calendar: calendar)
    }

    func testLedgerRoundTripAndRejectsCorruptDecodedAmounts() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.receive(message(1_000), now: now, calendar: calendar)
        let data = try JSONEncoder().encode(ledger)
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: data), ledger)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        json["monthlyBudget"] = -1
        XCTAssertThrowsError(try JSONDecoder().decode(SpendingLedger.self, from: JSONSerialization.data(withJSONObject: json)))
        let invalid = Data("{\"day\":\"2026-11-04\",\"approvals\":[-1]}".utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(DailySpending.self, from: invalid))
        let invalidDay = Data("{\"day\":\"2026-02-31\",\"approvals\":[]}".utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(DailySpending.self, from: invalidDay))
        let invalidSettings = Data("{\"identity\":\"student\",\"dailyBudget\":0,\"sources\":[]}".utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(AppSettings.self, from: invalidSettings))
    }

    func testDailySpendingRejectsOverflowInsteadOfTrapping() {
        var day = DailySpending(day: "2026-11-04")
        XCTAssertTrue(day.apply(.approval(maximumMoney)))
        XCTAssertFalse(day.apply(.approval(1)))
        XCTAssertFalse(day.apply(.approval(Int.max)))
        XCTAssertEqual(day.total, maximumMoney)
    }

    func testNonGregorianDeviceCalendarKeepsGregorianHistoryAndLocalRollover() throws {
        var hebrew = Calendar(identifier: .hebrew)
        hebrew.timeZone = calendar.timeZone
        let start = hebrew.date(from: DateComponents(year: 5787, month: 13, day: 1))!
        XCTAssertEqual(hebrew.component(.month, from: start), 13)
        let key = dayKey(for: start, calendar: calendar)
        XCTAssertEqual(dayKey(for: start, calendar: hebrew), key)
        XCTAssertEqual(spendingCalendar(timeZone: hebrew.timeZone).identifier, .gregorian)
        var ledger = SpendingLedger(now: start, calendar: hebrew)
        ledger.completeOnboarding(now: start, calendar: hebrew)
        try ledger.receive(message(100), now: start, calendar: hebrew)
        XCTAssertEqual(ledger.current.day, key)
        XCTAssertEqual(ledger.summary(for: start, now: start, calendar: hebrew),
                       ledger.summary(for: start, now: start, calendar: calendar))
        let nextDay = calendar.date(byAdding: .day, value: 1, to: start)!
        ledger.refresh(now: nextDay, calendar: hebrew)
        XCTAssertEqual(ledger.current.day, dayKey(for: nextDay, calendar: calendar))
        XCTAssertEqual(ledger.current.total, 0)
        XCTAssertEqual(ledger.records[key]?.total, 100)
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger)), ledger)
    }

    func testManualAddAndRemoveUpdateTodayAndMonthWithoutChangingReception() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.addSpending(12_000, expectedDay: ledger.current.day, now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.total, 12_000)
        XCTAssertEqual(ledger.records[ledger.current.day], DailyRecord(total: 12_000, budget: 20_000))
        XCTAssertEqual(ledger.summary(for: now, now: now, calendar: calendar).total, 12_000)
        XCTAssertEqual(ledger.summary(for: now, now: now, calendar: calendar).phraseCounts["슬슬 조절해볼까요?"], 1)
        XCTAssertNil(ledger.lastReception)
        try ledger.receive("KB국민체크 AYR테스트", now: now, calendar: calendar)
        let later = now.addingTimeInterval(60)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: later, calendar: calendar)
        try ledger.removeSpending(at: 0, expected: ledger.current, now: later, calendar: calendar)
        XCTAssertEqual(ledger.current.approvals, [100])
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, 100)
        XCTAssertEqual(ledger.summary(for: now, now: later, calendar: calendar).total, 100)
        XCTAssertEqual(ledger.lastReception, now)
    }

    func testDeletionUsesExactIndexForEqualAmountsAndPreservesOtherSources() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.receive(message(100), now: now, calendar: calendar)
        try ledger.addSpending(200, expectedDay: ledger.current.day, now: now, calendar: calendar)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: now, calendar: calendar)
        try ledger.removeSpending(at: 0, expected: ledger.current, now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.approvals, [200, 100])
        try ledger.removeSpending(at: 1, expected: ledger.current, now: now, calendar: calendar)
        try ledger.removeSpending(at: 0, expected: ledger.current, now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.total, 0)
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, 0)
        XCTAssertEqual(ledger.summary(for: now, now: now, calendar: calendar).total, 0)
    }

    func testManualMoneyBoundsAndOverflowLeaveSpendingUnchanged() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        for amount in [0, -1, maximumMoney + 1, Int.max] {
            XCTAssertThrowsError(try ledger.addSpending(amount, expectedDay: ledger.current.day, now: now, calendar: calendar)) {
                guard case LedgerError.invalidAmount = $0 else { return XCTFail("금액 유효성 오류가 필요합니다") }
            }
            XCTAssertEqual(ledger.current.total, 0)
        }
        try ledger.addSpending(maximumMoney, expectedDay: ledger.current.day, now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.addSpending(1, expectedDay: ledger.current.day, now: now, calendar: calendar)) {
            guard case LedgerError.amountOverflow = $0 else { return XCTFail("금액 범위 초과 오류가 필요합니다") }
        }
        XCTAssertEqual(ledger.current.total, maximumMoney)
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, maximumMoney)
    }

    func testDeletionRejectsSnapshotChangedByIncomingPaymentAndRepeatedDelete() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: now, calendar: calendar)
        let beforeArrival = ledger.current
        try ledger.receive(message(200), now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: beforeArrival, now: now, calendar: calendar)) {
            guard case LedgerError.spendingChanged = $0 else { return XCTFail("목록 변경 오류가 필요합니다") }
        }
        XCTAssertEqual(ledger.current.approvals, [100, 200])
        let beforeDelete = ledger.current
        try ledger.removeSpending(at: 0, expected: beforeDelete, now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: beforeDelete, now: now, calendar: calendar)) {
            guard case LedgerError.spendingChanged = $0 else { return XCTFail("목록 변경 오류가 필요합니다") }
        }
        XCTAssertEqual(ledger.current.approvals, [200])
    }

    func testDeletionRejectsInvalidIndexWithoutChangingRecords() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: now, calendar: calendar)
        let unchanged = ledger
        for index in [-1, 1, Int.max] {
            XCTAssertThrowsError(try ledger.removeSpending(at: index, expected: ledger.current, now: now, calendar: calendar)) {
                guard case LedgerError.spendingChanged = $0 else { return XCTFail("목록 변경 오류가 필요합니다") }
            }
            XCTAssertEqual(ledger, unchanged)
        }
    }

    func testOldDayAddFormAndDeleteConfirmationCannotChangeNewDay() throws {
        let start = date("2026-11-04")
        let next = date("2026-11-05")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: start, calendar: calendar)
        let yesterday = ledger.current
        XCTAssertThrowsError(try ledger.addSpending(200, expectedDay: yesterday.day, now: next, calendar: calendar)) {
            guard case LedgerError.dayChanged = $0 else { return XCTFail("날짜 변경 오류가 필요합니다") }
        }
        try ledger.receive(message(300), now: next, calendar: calendar)
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: yesterday, now: next, calendar: calendar)) {
            guard case LedgerError.dayChanged = $0 else { return XCTFail("날짜 변경 오류가 필요합니다") }
        }
        XCTAssertEqual(ledger.current.approvals, [300])
        XCTAssertEqual(ledger.records[yesterday.day]?.total, 100)
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, 300)
    }

    func testManualChangesRequireCompletedOnboarding() {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.addSpending(100, expectedDay: ledger.current.day, now: now, calendar: calendar)) {
            guard case LedgerError.notConfigured = $0 else { return XCTFail("초기 설정 오류가 필요합니다") }
        }
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: ledger.current, now: now, calendar: calendar)) {
            guard case LedgerError.notConfigured = $0 else { return XCTFail("초기 설정 오류가 필요합니다") }
        }
        XCTAssertTrue(ledger.records.isEmpty)
        XCTAssertEqual(ledger.current.total, 0)
    }

    func testIncomingTextAlwaysCountsAfterManualEntryAndDeletion() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.addSpending(100, expectedDay: ledger.current.day, now: now, calendar: calendar)
        try ledger.receive(message(100), now: now, calendar: calendar)
        try ledger.receive(message(100), now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.approvals, [100, 100, 100])
        try ledger.removeSpending(at: 1, expected: ledger.current, now: now, calendar: calendar)
        try ledger.receive(message(100), now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.approvals, [100, 100, 100])
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, 300)
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger)), ledger)
    }
}
