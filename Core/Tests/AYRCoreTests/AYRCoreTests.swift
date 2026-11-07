import Foundation
import XCTest
@testable import AYRCore

final class AYRCoreTests: XCTestCase {
    func testPhraseBoundaries() {
        let budget = Identity.student.defaultBudget // 20,000원
        XCTAssertEqual(phrase(total: 0, budget: budget), "아직은 여유 있네")
        XCTAssertEqual(phrase(total: 9_999, budget: budget), "아직은 여유 있네")
        XCTAssertEqual(phrase(total: 10_000, budget: budget), "오늘 좀 쓰는데?")
        XCTAssertEqual(phrase(total: 19_999, budget: budget), "오늘 좀 쓰는데?")
        XCTAssertEqual(phrase(total: 20_000, budget: budget), "님 부자임?")
    }

    func testSameAmountDiffersByIdentity() {
        XCTAssertEqual(phrase(total: 25_000, budget: Identity.student.defaultBudget), "님 부자임?")
        XCTAssertEqual(phrase(total: 25_000, budget: Identity.jobSeeker.defaultBudget), "오늘 좀 쓰는데?")
        XCTAssertEqual(phrase(total: 25_000, budget: Identity.worker.defaultBudget), "오늘 좀 쓰는데?")
        XCTAssertEqual(phrase(total: 24_999, budget: Identity.worker.defaultBudget), "아직은 여유 있네")
    }

    func testBanner() {
        XCTAssertEqual(banner(total: 12_000, budget: 20_000), "오늘 12,000원 · 오늘 좀 쓰는데?")
        XCTAssertEqual(banner(total: 1_234_567, budget: 50_000), "오늘 1,234,567원 · 님 부자임?")
    }

    func testSettingsBudgetDefaultsAndValidation() {
        XCTAssertEqual(AppSettings(identity: .jobSeeker)?.dailyBudget, 30_000)
        XCTAssertEqual(AppSettings(identity: .student, dailyBudget: 15_000)?.dailyBudget, 15_000)
        XCTAssertNil(AppSettings(identity: .student, dailyBudget: 0))
        XCTAssertNil(AppSettings(identity: .student, dailyBudget: -1))
    }

    func testSettingsParseOnlySelectedSupportedSources() {
        let none = AppSettings(identity: .student)!
        XCTAssertNil(none.parse(kbApproval)) // KB 미선택

        let kb = AppSettings(identity: .student, sources: [.kbCheckSMS])!
        XCTAssertEqual(kb.parse(kbApproval), .approval(5_100))
        XCTAssertNil(kb.parse("아무 문자"))

        let tossOnly = AppSettings(identity: .student, sources: [.tossNotification])!
        XCTAssertNil(tossOnly.parse(kbApproval)) // 준비 중 수단은 해석하지 않음
    }

    func testReceptionTestIsNotCounted() {
        let settings = AppSettings(identity: .student, sources: [.kbCheckSMS])!
        let message = PaymentSource.kbCheckSMS.testMessage
        XCTAssertEqual(message, "KB국민체크 AYR테스트")
        XCTAssertEqual(settings.parse(message), .test)

        var day = DailySpending(day: "2026-11-03")
        XCTAssertFalse(day.apply(.test))
        XCTAssertEqual(day.total, 0)
    }

    func testOnlyConfirmedSourcesAreSupported() {
        XCTAssertEqual(PaymentSource.allCases.filter(\.isSupported), [.kbCheckSMS])
    }

    func testApprovalsSumAndRejectNonPositive() {
        var day = DailySpending(day: "2026-11-03")
        XCTAssertTrue(day.apply(.approval(8_500)))
        XCTAssertTrue(day.apply(.approval(8_500))) // 같은 금액의 별도 결제
        XCTAssertFalse(day.apply(.approval(0)))
        XCTAssertFalse(day.apply(.approval(-100)))
        XCTAssertEqual(day.total, 17_000)
    }

    func testCancellationOnlyMatchesTodaysApproval() {
        var day = DailySpending(day: "2026-11-03", approvals: [8_500, 3_000])
        XCTAssertTrue(day.apply(.cancellation(3_000)))
        XCTAssertEqual(day.total, 8_500)
        XCTAssertFalse(day.apply(.cancellation(3_000))) // 이미 취소됨 / 전날 결제
        XCTAssertFalse(day.apply(.cancellation(1_000))) // 부분 취소
        XCTAssertFalse(day.apply(.cancellation(0)))
        XCTAssertEqual(day.total, 8_500)
    }

    func testRollsOverOnNewDay() {
        let today = DailySpending(day: "2026-11-03", approvals: [5_000])
        XCTAssertEqual(today.rolled(to: "2026-11-03").total, 5_000)
        XCTAssertEqual(today.rolled(to: "2026-11-04"), DailySpending(day: "2026-11-04"))
    }

    func testDayKeyUsesGivenTimeZone() {
        var seoul = Calendar(identifier: .gregorian)
        seoul.timeZone = TimeZone(identifier: "Asia/Seoul")!
        let utcLateNight = Date(timeIntervalSince1970: 1_793_718_000) // 2026-11-03T15:00:00Z = 서울 11-04 00:00
        XCTAssertEqual(dayKey(for: utcLateNight, calendar: seoul), "2026-11-04")
        XCTAssertEqual(dayKey(for: utcLateNight.addingTimeInterval(-1), calendar: seoul), "2026-11-03")
    }

    private let kbApproval = "[Web발신]\nKB국민체크(1234)\n홍*동님\n11/03 19:46\n5,100원\n가게이름 사용"

    func testParsesKBCheckApproval() {
        XCTAssertEqual(parseKBMessage(kbApproval), .approval(5_100))
        XCTAssertEqual(parseKBMessage(kbApproval.replacingOccurrences(of: "\n", with: "\r\n")), .approval(5_100))
        XCTAssertEqual(parseKBMessage(kbApproval.replacingOccurrences(of: "5,100원", with: "1,234,567원")), .approval(1_234_567))
    }

    func testRejectsUnknownKBMessages() {
        // 형식을 확인하지 않은 취소·기타 문자는 합산하지 않는다.
        XCTAssertNil(parseKBMessage(kbApproval.replacingOccurrences(of: "가게이름 사용", with: "가게이름 취소")))
        XCTAssertNil(parseKBMessage(kbApproval.replacingOccurrences(of: "KB국민체크", with: "OO은행")))
        XCTAssertNil(parseKBMessage(kbApproval.replacingOccurrences(of: "5,100원\n", with: "")))
        XCTAssertNil(parseKBMessage(kbApproval.replacingOccurrences(of: "5,100원", with: "0원")))
        XCTAssertNil(parseKBMessage(kbApproval.replacingOccurrences(of: "5,100원", with: "5,100원\n누적\n9,000원")))
        XCTAssertNil(parseKBMessage(""))
    }

    func testSettingsCodableRoundTrip() throws {
        let settings = AppSettings(identity: .worker, dailyBudget: 40_000, sources: [.kbCheckSMS])!
        XCTAssertEqual(try JSONDecoder().decode(AppSettings.self, from: JSONEncoder().encode(settings)), settings)
    }

    func testCodableRoundTrip() throws {
        let day = DailySpending(day: "2026-11-03", approvals: [1, 2])
        let decoded = try JSONDecoder().decode(DailySpending.self, from: JSONEncoder().encode(day))
        XCTAssertEqual(decoded, day)
    }
}
