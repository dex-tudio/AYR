import Foundation
import XCTest
@testable import AYRCore

final class AYRCoreTests: XCTestCase {
    func testPhraseBoundaries() {
        let student = Identity.student // 20,000원
        XCTAssertEqual(student.phrase(for: 0), "아직 여유 있어요")
        XCTAssertEqual(student.phrase(for: 9_999), "아직 여유 있어요")
        XCTAssertEqual(student.phrase(for: 10_000), "슬슬 조절해볼까요?")
        XCTAssertEqual(student.phrase(for: 19_999), "슬슬 조절해볼까요?")
        XCTAssertEqual(student.phrase(for: 20_000), "님 부자임?")
    }

    func testSameAmountDiffersByIdentity() {
        XCTAssertEqual(Identity.student.phrase(for: 25_000), "님 부자임?")
        XCTAssertEqual(Identity.jobSeeker.phrase(for: 25_000), "슬슬 조절해볼까요?")
        XCTAssertEqual(Identity.worker.phrase(for: 25_000), "슬슬 조절해볼까요?")
        XCTAssertEqual(Identity.worker.phrase(for: 24_999), "아직 여유 있어요")
    }

    func testBanner() {
        XCTAssertEqual(Identity.student.banner(for: 12_000), "오늘 12,000원 · 슬슬 조절해볼까요?")
        XCTAssertEqual(Identity.worker.banner(for: 1_234_567), "오늘 1,234,567원 · 님 부자임?")
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

    func testCodableRoundTrip() throws {
        let day = DailySpending(day: "2026-11-03", approvals: [1, 2])
        let decoded = try JSONDecoder().decode(DailySpending.self, from: JSONEncoder().encode(day))
        XCTAssertEqual(decoded, day)
    }
}
