import Foundation
import XCTest
@testable import AYRCore

final class LedgerPolicyTests: XCTestCase {
    private let calendar = spendingCalendar(timeZone: TimeZone(identifier: "Asia/Seoul")!)

    private func date(_ key: String) -> Date { dateFromKey(key, calendar: calendar)! }

    private func message(_ amount: Int) -> String {
        "[Web발신]\nKB국민체크(1234)\n가*명님\n11/03 19:46\n\(amount)원\n가짜가게 사용"
    }

    func testOnboardingAfterDateChangeDoesNotCreateEarlierZeroDays() throws {
        var ledger = SpendingLedger(now: date("2026-11-01"), calendar: calendar)
        try ledger.receive("KB국민체크 AYR테스트", now: date("2026-11-02"), calendar: calendar)
        ledger.completeOnboarding(now: date("2026-11-03"), calendar: calendar)
        ledger.refresh(now: date("2026-11-05"), calendar: calendar)
        XCTAssertEqual(ledger.firstDay, "2026-11-03")
        XCTAssertEqual(ledger.records.keys.sorted(), ["2026-11-03", "2026-11-04", "2026-11-05"])
        let summary = ledger.summary(for: date("2026-11-01"), now: date("2026-11-05"), calendar: calendar)
        XCTAssertNil(summary.days[1].total)
        XCTAssertEqual(summary.phraseCounts["아직 여유 있어요"], 3)
    }

    func testReturningToFoldedDayProtectsTotalAndOriginalBudgetAcrossSettingsChange() throws {
        let start = date("2026-11-03")
        let next = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(5_000), now: start, calendar: calendar)
        try ledger.receive(message(7_000), now: start, calendar: calendar)
        let original = ledger.current
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: next, calendar: calendar)
        ledger.refresh(now: start, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, 12_000)
        XCTAssertEqual(ledger.current.approvals, [])
        XCTAssertEqual(ledger.currentBudget, 20_000)
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: original, now: start, calendar: calendar))
        XCTAssertThrowsError(try ledger.removeSpending(at: 0, expected: ledger.current, now: start, calendar: calendar))
        try ledger.updateSettings(AppSettings(identity: .jobSeeker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: start, calendar: calendar)
        XCTAssertEqual(ledger.currentBudget, 20_000)
        XCTAssertEqual(ledger.records["2026-11-03"]?.budget, 20_000)
        try ledger.addSpending(100, expectedDay: "2026-11-03", now: start, calendar: calendar)
        XCTAssertEqual(ledger.current.total, 12_100)
        try ledger.removeSpending(at: 0, expected: ledger.current, now: start, calendar: calendar)
        XCTAssertEqual(ledger.current.total, 12_000)
        ledger.refresh(now: next, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, 0)
        XCTAssertEqual(ledger.currentBudget, 50_000)
        ledger.refresh(now: start, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, 12_000)
        XCTAssertEqual(ledger.current.approvals, [])
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger)), ledger)
        var corrupt = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(ledger)) as? [String: Any])
        corrupt["restoredDayBudget"] = 30_000
        XCTAssertThrowsError(try JSONDecoder().decode(SpendingLedger.self, from: JSONSerialization.data(withJSONObject: corrupt)))
    }

    func testZeroSpendingFoldedDayAlsoKeepsOriginalBudget() throws {
        let start = date("2026-11-03")
        let next = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: next, calendar: calendar)
        ledger.refresh(now: start, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .jobSeeker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: start, calendar: calendar)
        try ledger.receive(message(100), now: start, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, 0)
        XCTAssertEqual(ledger.currentBudget, 20_000)
        XCTAssertEqual(ledger.records["2026-11-03"], DailyRecord(total: 100, budget: 20_000))
    }

    func testCarriedBaseCannotBeCancelledAndCountsTowardOverflow() throws {
        var day = DailySpending(day: "2026-11-03", approvals: [100], carriedTotal: 12_000)
        XCTAssertFalse(day.apply(.cancellation(12_000)))
        XCTAssertTrue(day.apply(.cancellation(100)))
        XCTAssertEqual(day.total, 12_000)
        XCTAssertFalse(day.removeApproval(at: 0))
        day = DailySpending(day: "2026-11-03", carriedTotal: maximumMoney)
        XCTAssertFalse(day.apply(.approval(1)))
        let encoded = try JSONEncoder().encode(day)
        XCTAssertEqual(try JSONDecoder().decode(DailySpending.self, from: encoded), day)
        let old = Data("{\"day\":\"2026-11-03\",\"approvals\":[100]}".utf8)
        XCTAssertEqual(try JSONDecoder().decode(DailySpending.self, from: old).carriedTotal, 0)
        let corrupt = Data("{\"day\":\"2026-11-03\",\"approvals\":[1],\"carriedTotal\":\(maximumMoney)}".utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(DailySpending.self, from: corrupt))
    }

    func testRepeatedForwardBackwardTransitionsKeepProtectedBaseAndTotalsExactlyOnce() throws {
        let start = date("2026-11-03")
        let next = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.addSpending(100, expectedDay: "2026-11-03", now: start, calendar: calendar)
        try ledger.addSpending(200, expectedDay: "2026-11-04", now: next, calendar: calendar)
        for _ in 0..<3 {
            ledger.refresh(now: start, calendar: calendar)
            XCTAssertEqual(ledger.current.total, 100)
            ledger.refresh(now: next, calendar: calendar)
            XCTAssertEqual(ledger.current.total, 200)
        }
        try ledger.addSpending(50, expectedDay: "2026-11-04", now: next, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, 200)
        XCTAssertEqual(ledger.current.approvals, [50])
        XCTAssertEqual(ledger.summary(for: start, now: next, calendar: calendar).total, 350)
    }

    func testTimezoneEarlierThanOnboardingOnlyShowsExplicitRecords() throws {
        let now = date("2026-11-04")
        let pacific = spendingCalendar(timeZone: TimeZone(identifier: "America/Los_Angeles")!)
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        ledger.refresh(now: now, calendar: pacific)
        XCTAssertNil(ledger.records["2026-11-03"])
        try ledger.receive(message(100), now: now, calendar: pacific)
        XCTAssertEqual(ledger.firstDay, "2026-11-04")
        XCTAssertEqual(ledger.records["2026-11-03"]?.total, 100)
        XCTAssertNil(ledger.records["2026-11-02"])
        ledger.refresh(now: now, calendar: calendar)
        ledger.refresh(now: now, calendar: pacific)
        XCTAssertEqual(ledger.current.carriedTotal, 100)
        XCTAssertEqual(ledger.current.approvals, [])
    }

    func testRepeatedBackwardDatesNeverArchiveSyntheticZeroDaysBeforeOnboarding() throws {
        let start = date("2026-11-05")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        ledger.refresh(now: date("2026-11-04"), calendar: calendar)
        ledger.refresh(now: date("2026-11-03"), calendar: calendar)
        XCTAssertEqual(ledger.records.keys.sorted(), ["2026-11-05"])
        try ledger.receive(message(100), now: date("2026-11-03"), calendar: calendar)
        ledger.refresh(now: date("2026-11-02"), calendar: calendar)
        ledger.refresh(now: date("2026-11-01"), calendar: calendar)
        XCTAssertEqual(ledger.records.keys.sorted(), ["2026-11-03", "2026-11-05"])
        XCTAssertEqual(ledger.records["2026-11-03"]?.total, 100)
    }

    func testMonthlyCustomBudgetsFreezePastMonthsAndCarryRecurringSettingAcrossGaps() throws {
        let start = date("2026-10-01")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.updateSettings(ledger.settings, monthlyBudget: 100_000, now: start, calendar: calendar)
        let november = date("2026-11-04")
        try ledger.updateSettings(ledger.settings, monthlyBudget: 200_000, now: november, calendar: calendar)
        XCTAssertEqual(ledger.summary(for: start, now: november, calendar: calendar).budget, 100_000)
        XCTAssertEqual(ledger.summary(for: november, now: november, calendar: calendar).budget, 200_000)
        let february = date("2027-02-03")
        try ledger.updateSettings(ledger.settings, monthlyBudget: 250_000, now: february, calendar: calendar)
        XCTAssertEqual(ledger.monthBudgets["2026-12"], 200_000)
        XCTAssertEqual(ledger.monthBudgets["2027-01"], 200_000)
        XCTAssertEqual(ledger.monthBudgets["2027-02"], 250_000)
        XCTAssertEqual(ledger.monthlyBudget, 250_000)
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger)), ledger)
    }

    func testMonthlyDefaultSnapshotUsesCurrentSettingOnlyForCurrentAndNewMonths() throws {
        let start = date("2026-10-01")
        let november = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: november, calendar: calendar)
        XCTAssertEqual(ledger.summary(for: start, now: november, calendar: calendar).budget, 620_000)
        XCTAssertEqual(ledger.summary(for: november, now: november, calendar: calendar).budget, 1_500_000)
        ledger.refresh(now: date("2026-12-03"), calendar: calendar)
        XCTAssertEqual(ledger.monthBudgets["2026-12"], 1_550_000)
        XCTAssertEqual(ledger.monthBudgets["2026-10"], 620_000)
    }

    func testSettingsChangedWhileRevisitingArchivedMonthDoNotRewriteFrozenBudget() throws {
        let october = date("2026-10-31")
        let november = date("2026-11-01")
        var ledger = SpendingLedger(now: october, calendar: calendar)
        ledger.completeOnboarding(now: october, calendar: calendar)
        try ledger.updateSettings(ledger.settings, monthlyBudget: 100_000, now: october, calendar: calendar)
        try ledger.updateSettings(ledger.settings, monthlyBudget: 200_000, now: november, calendar: calendar)
        ledger.refresh(now: october, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: 300_000,
                                  now: october, calendar: calendar)
        XCTAssertEqual(ledger.currentBudget, 20_000)
        XCTAssertEqual(ledger.monthBudgets["2026-10"], 100_000)
        XCTAssertEqual(ledger.monthBudgets["2026-11"], 200_000)
        ledger.refresh(now: date("2026-12-01"), calendar: calendar)
        XCTAssertEqual(ledger.monthBudgets["2026-12"], 300_000)
    }

    func testFutureMissingDaysUseNewGlobalBudgetAfterSettingsChangeOnRestoredDate() throws {
        let first = date("2026-11-01")
        let second = date("2026-11-02")
        let later = date("2026-11-05")
        var ledger = SpendingLedger(now: first, calendar: calendar)
        ledger.completeOnboarding(now: first, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: second, calendar: calendar)
        ledger.refresh(now: first, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .jobSeeker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: first, calendar: calendar)
        XCTAssertEqual(ledger.currentBudget, 20_000)
        ledger.refresh(now: later, calendar: calendar)
        XCTAssertEqual(ledger.records["2026-11-01"]?.budget, 20_000)
        XCTAssertEqual(ledger.records["2026-11-02"]?.budget, 50_000)
        XCTAssertEqual(ledger.records["2026-11-03"]?.budget, 30_000)
        XCTAssertEqual(ledger.records["2026-11-04"]?.budget, 30_000)
        XCTAssertEqual(ledger.currentBudget, 30_000)
        ledger.refresh(now: date("2027-02-03"), calendar: calendar)
        XCTAssertEqual(ledger.monthBudgets["2026-12"], 930_000)
        XCTAssertEqual(ledger.monthBudgets["2027-01"], 930_000)
    }

    func testMonthlySnapshotsRetainTwelveMonths() throws {
        let start = date("2025-10-01")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        ledger.refresh(now: date("2026-11-04"), calendar: calendar)
        XCTAssertEqual(ledger.monthBudgets.count, 12)
        XCTAssertEqual(ledger.monthBudgets.keys.min(), "2025-12")
        XCTAssertEqual(ledger.monthBudgets.keys.max(), "2026-11")
    }

    func testLegacyDecodeBackfillsDefaultSnapshotsFromDayBudgetsAndKeepsLatestCustomFallback() throws {
        let start = date("2026-10-01")
        let november = date("2026-11-04")
        var ledger = SpendingLedger(now: start, calendar: calendar)
        ledger.completeOnboarding(now: start, calendar: calendar)
        try ledger.receive(message(100), now: start, calendar: calendar)
        try ledger.updateSettings(AppSettings(identity: .worker, sources: [.kbCheckSMS])!, monthlyBudget: nil,
                                  now: november, calendar: calendar)
        var old = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(ledger)) as? [String: Any])
        old.removeValue(forKey: "monthBudgets")
        old.removeValue(forKey: "restoredDayBudget")
        old.removeValue(forKey: "lastAttempt")
        var daily = try XCTUnwrap(old["current"] as? [String: Any])
        daily.removeValue(forKey: "carriedTotal")
        old["current"] = daily
        let decoded = try JSONDecoder().decode(SpendingLedger.self, from: JSONSerialization.data(withJSONObject: old))
        XCTAssertEqual(decoded.monthBudgets["2026-10"], 620_000)
        XCTAssertEqual(decoded.monthBudgets["2026-11"], 1_500_000)
        XCTAssertEqual(decoded.current.carriedTotal, 0)
        XCTAssertNil(decoded.lastAttempt)
        XCTAssertEqual(decoded.records["2026-10-01"]?.total, 100)
        old["monthlyBudget"] = 200_000
        let custom = try JSONDecoder().decode(SpendingLedger.self, from: JSONSerialization.data(withJSONObject: old))
        XCTAssertEqual(custom.monthBudgets["2026-10"], 200_000)
        XCTAssertEqual(custom.monthBudgets["2026-11"], 200_000)
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(custom)), custom)
        old["monthBudgets"] = ["2026-13": 100]
        XCTAssertThrowsError(try JSONDecoder().decode(SpendingLedger.self, from: JSONSerialization.data(withJSONObject: old)))
    }

    func testReceptionAttemptDistinguishesSuccessTestAndIgnoredWithoutChangingLastGoodReceipt() throws {
        let now = date("2026-11-04")
        let later = now.addingTimeInterval(60)
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        XCTAssertTrue(try ledger.receive(message(100), now: now, calendar: calendar))
        XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: now, status: .success))
        XCTAssertFalse(try ledger.receive("지원하지 않는 가짜 내용", now: later, calendar: calendar))
        XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: later, status: .ignored))
        XCTAssertEqual(ledger.lastReception, now)
        XCTAssertEqual(ledger.current.total, 100)
        let testDate = later.addingTimeInterval(60)
        XCTAssertFalse(try ledger.receive("KB국민체크 AYR테스트", now: testDate, calendar: calendar))
        XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: testDate, status: .test))
        XCTAssertEqual(ledger.lastReception, testDate)
        try ledger.addSpending(50, expectedDay: ledger.current.day, now: testDate, calendar: calendar)
        try ledger.removeSpending(at: 0, expected: ledger.current, now: testDate, calendar: calendar)
        XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: testDate, status: .test))
    }

    func testBeforeOnboardingEveryRealAttemptFailsButTestMarkerIsAllowed() throws {
        let now = date("2026-11-04")
        var ledger = SpendingLedger(now: now, calendar: calendar)
        for text in [message(100), "알 수 없는 가짜 본문"] {
            XCTAssertThrowsError(try ledger.receive(text, now: now, calendar: calendar)) {
                guard case LedgerError.notConfigured = $0 else { return XCTFail("초기 설정 오류가 필요합니다") }
            }
            XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: now, status: .notConfigured))
            XCTAssertNil(ledger.lastReception)
            XCTAssertEqual(ledger.current.total, 0)
        }
        XCTAssertEqual(try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger)), ledger)
        XCTAssertFalse(try ledger.receive("KB국민체크 AYR테스트", now: now, calendar: calendar))
        XCTAssertEqual(ledger.lastAttempt?.status, .test)
        XCTAssertEqual(ledger.lastReception, now)
        XCTAssertFalse(ledger.onboardingCompleted)
        XCTAssertTrue(ledger.records.isEmpty)
    }

    func testOverflowAttemptSurvivesCaughtErrorAndRoundTripWithoutChangingMoneyOrLastGoodReceipt() throws {
        let now = date("2026-11-04")
        let later = now.addingTimeInterval(60)
        var ledger = SpendingLedger(now: now, calendar: calendar)
        ledger.completeOnboarding(now: now, calendar: calendar)
        try ledger.receive(message(maximumMoney), now: now, calendar: calendar)
        XCTAssertThrowsError(try ledger.receive(message(1), now: later, calendar: calendar)) {
            guard case LedgerError.amountOverflow = $0 else { return XCTFail("범위 초과 오류가 필요합니다") }
        }
        XCTAssertEqual(ledger.lastAttempt, ReceptionAttempt(date: later, status: .overflow))
        XCTAssertEqual(ledger.lastReception, now)
        XCTAssertEqual(ledger.current.total, maximumMoney)
        XCTAssertEqual(ledger.records[ledger.current.day]?.total, maximumMoney)
        let decoded = try JSONDecoder().decode(SpendingLedger.self, from: JSONEncoder().encode(ledger))
        XCTAssertEqual(decoded, ledger)
        let next = date("2026-11-05")
        ledger.refresh(now: next, calendar: calendar)
        ledger.refresh(now: now, calendar: calendar)
        XCTAssertEqual(ledger.current.carriedTotal, maximumMoney)
        XCTAssertThrowsError(try ledger.receive(message(1), now: later, calendar: calendar))
        XCTAssertThrowsError(try ledger.addSpending(1, expectedDay: ledger.current.day, now: later, calendar: calendar))
        XCTAssertEqual(ledger.current.total, maximumMoney)
        XCTAssertEqual(ledger.lastReception, now)
    }

    func testReceptionAttemptContainsOnlySafeDateAndStatus() throws {
        let now = date("2026-11-04")
        for status in [ReceptionStatus.success, .test, .ignored, .overflow, .notConfigured] {
            let attempt = ReceptionAttempt(date: now, status: status)
            let data = try JSONEncoder().encode(attempt)
            let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            XCTAssertEqual(Set(object.keys), ["date", "status"])
            XCTAssertEqual(object["status"] as? String, status.rawValue)
            XCTAssertFalse(status.message.isEmpty)
            XCTAssertEqual(try JSONDecoder().decode(ReceptionAttempt.self, from: data), attempt)
        }
    }
}
