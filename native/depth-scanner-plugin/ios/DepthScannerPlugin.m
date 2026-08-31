import Foundation
import Capacitor

/// Objective-C bridge per registrare il plugin Swift lato Capacitor.
@objc(DepthScannerPlugin)
public class DepthScannerPluginPlugin: NSObject {
  public static let jsName = "DepthScanner"
  public static let pluginId = "DepthScannerPlugin"

  // I metodi sono esposti dal plugin Swift omonimo; questo file garantisce
  // la registrazione del modulo nel bridge Capacitor.
}

@objc(DepthScannerPlugin)
public class DepthScannerPluginPluginExport: NSObject {
  @objc static public func register() {
    // Placeholder: la registrazione avviene tramite CAPBridge in Xcode.
  }
}