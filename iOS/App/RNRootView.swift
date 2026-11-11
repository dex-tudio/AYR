import Expo
import React
import ReactAppDependencyProvider
import SwiftUI

final class AYRExpoAppDelegate: ExpoAppDelegate {}

struct RNRootView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIView {
        context.coordinator.factory.recreateRootView(
            withBundleURL: nil, moduleName: "main", initialProps: nil, launchOptions: nil
        )
    }

    func updateUIView(_ view: UIView, context: Context) {}

    @MainActor
    final class Coordinator {
        let delegate: RNDelegate
        let factory: ExpoReactNativeFactory
        init() {
            let delegate = RNDelegate()
            delegate.dependencyProvider = RCTAppDependencyProvider()
            self.delegate = delegate
            self.factory = ExpoReactNativeFactory(delegate: delegate)
        }
    }
}

private final class RNDelegate: ExpoReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? { bridge.bundleURL ?? bundleURL() }

    override func bundleURL() -> URL? {
#if DEBUG
        RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
        Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    }
}
