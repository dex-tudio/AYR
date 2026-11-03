// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AYRCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "AYRCore", targets: ["AYRCore"])],
    targets: [
        .target(name: "AYRCore"),
        .testTarget(name: "AYRCoreTests", dependencies: ["AYRCore"]),
    ]
)
