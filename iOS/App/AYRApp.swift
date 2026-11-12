import SwiftUI

@main
struct AYRApp: App {
    @UIApplicationDelegateAdaptor(AYRExpoAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup { RNRootView() }
    }
}
