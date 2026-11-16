import XCTest
import UIKit

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

    func testNativeWindowSurvivesOrientationAndForegroundChanges() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let connected = app.staticTexts["ayr-native-connected"].firstMatch
        XCTAssertTrue(connected.waitForExistence(timeout: 60))

        defer { XCUIDevice.shared.orientation = .portrait }
        for orientation in [UIDeviceOrientation.landscapeLeft, .portrait] {
            XCUIDevice.shared.orientation = orientation
            XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
            XCTAssertTrue(connected.waitForExistence(timeout: 10))
        }

        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 10) || app.state == .runningBackgroundSuspended)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        XCTAssertTrue(connected.waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        XCTAssertTrue(connected.waitForExistence(timeout: 60))
    }
}
