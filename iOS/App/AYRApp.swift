internal import Expo
import React
import ReactAppDependencyProvider

@main
final class AYRApp: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
    var window: UIWindow?
    private var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let delegate = RNDelegate()
        delegate.dependencyProvider = RCTAppDependencyProvider()
        reactNativeDelegate = delegate
        reactNativeFactory = ExpoReactNativeFactory(delegate: delegate)
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}
