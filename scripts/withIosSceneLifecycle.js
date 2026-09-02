/**
 * Expo config plugin: adopt UIScene lifecycle required by iOS 27 / Xcode 27 beta.
 * See https://github.com/expo/expo/issues/46663
 */
const fs = require("fs");
const path = require("path");
const {
  withInfoPlist,
  withDangerousMod,
  IOSConfig,
} = require("@expo/config-plugins");

const SCENE_DELEGATE = `internal import Expo
internal import ExpoModulesCore
import React

/// Bridge so the scene delegate can reach the factory created in AppDelegate.
protocol ExpoReactNativeFactoryProvider: AnyObject {
  var window: UIWindow? { get set }
  var reactNativeFactory: RCTReactNativeFactory? { get }
  var reactNativeFactoryModuleName: String { get }
}

extension ExpoReactNativeFactoryProvider {
  var reactNativeFactoryModuleName: String { "main" }
}

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let provider = UIApplication.shared.delegate as? ExpoReactNativeFactoryProvider,
          let factory = provider.reactNativeFactory else {
      fatalError(
        "SceneDelegate couldn't start React Native because AppDelegate doesn't provide a factory."
      )
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    provider.window = window

    let browsingWebActivity = connectionOptions.userActivities.first {
      $0.activityType == NSUserActivityTypeBrowsingWeb
    }
    factory.startReactNative(
      withModuleName: provider.reactNativeFactoryModuleName,
      in: window,
      launchOptions: Self.launchOptions(
        url: connectionOptions.urlContexts.first?.url,
        userActivity: browsingWebActivity
      )
    )

    Self.route(urlContexts: connectionOptions.urlContexts)
    connectionOptions.userActivities.forEach { Self.route(userActivity: $0) }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    window = nil
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    Self.route(urlContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    Self.route(userActivity: userActivity)
  }
}

private extension SceneDelegate {
  static func launchOptions(
    url: URL?,
    userActivity: NSUserActivity?
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url {
      launchOptions[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsURLKey")] = url
    }
    if let userActivity {
      launchOptions[
        UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsUserActivityDictionaryKey")
      ] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }
    return launchOptions.isEmpty ? nil : launchOptions
  }

  static func route(urlContexts: Set<UIOpenURLContext>) {
    for context in urlContexts {
      let options = openURLOptions(from: context.options)
      _ = ExpoAppDelegateSubscriberManager.application(
        UIApplication.shared,
        open: context.url,
        options: options
      )
      RCTLinkingManager.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  static func route(userActivity: NSUserActivity) {
    _ = ExpoAppDelegateSubscriberManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }

  static func openURLOptions(
    from sceneOptions: UIScene.OpenURLOptions
  ) -> [UIApplication.OpenURLOptionsKey: Any] {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication = sceneOptions.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }
    if let annotation = sceneOptions.annotation {
      options[.annotation] = annotation
    }
    options[.openInPlace] = sceneOptions.openInPlace
    return options
  }
}
`;

const APP_DELEGATE = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // The window is created and React Native is started by SceneDelegate under the
    // scene-based life cycle required by the iOS 27 SDK.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
`;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return config;
  });
}

function withSceneNativeFiles(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = path.join(projectRoot, "ios");
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const appDir = path.join(iosRoot, projectName);

      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, "SceneDelegate.swift"), SCENE_DELEGATE);
      fs.writeFileSync(path.join(appDir, "AppDelegate.swift"), APP_DELEGATE);

      const project = IOSConfig.XcodeUtils.getPbxproj(projectRoot);
      if (!project.hasFile(`${projectName}/SceneDelegate.swift`)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: `${projectName}/SceneDelegate.swift`,
          groupName: projectName,
          project,
          verbose: true,
        });
      }
      fs.writeFileSync(IOSConfig.Paths.getPBXProjectPath(projectRoot), project.writeSync());

      return config;
    },
  ]);
}

function withIosSceneLifecycle(config) {
  config = withSceneInfoPlist(config);
  config = withSceneNativeFiles(config);
  return config;
}

module.exports = withIosSceneLifecycle;
