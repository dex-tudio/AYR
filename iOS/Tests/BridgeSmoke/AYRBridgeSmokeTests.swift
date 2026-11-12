import XCTest

final class AYRBridgeSmokeTests: XCTestCase {
    func testReleaseBundleReadsNativeSnapshot() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        // This identifier lives on visible RN Text, after a successful native snapshot (including fresh onboarding).
        let connected = app.staticTexts["ayr-native-connected"].firstMatch
        XCTAssertTrue(connected.waitForExistence(timeout: 60), "Release RN → AYRNative snapshot did not appear")
        XCTAssertFalse(connected.label.isEmpty)
        XCTAssertFalse(app.staticTexts["미리보기 · 가짜 기록"].exists)
    }
}
