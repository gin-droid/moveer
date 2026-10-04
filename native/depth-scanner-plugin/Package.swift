// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "MoveeraiDepthScanner",
  platforms: [.iOS(.v15)],
  products: [
    .library(name: "MoveeraiDepthScanner", targets: ["DepthScannerPlugin"])
  ],
  dependencies: [
    .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.2")
  ],
  targets: [
    .target(
      name: "DepthScannerPlugin",
      dependencies: [
        .product(name: "Capacitor", package: "capacitor-swift-pm")
      ],
      path: "ios"
    )
  ]
)