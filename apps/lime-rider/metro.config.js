// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(repoRoot, "packages/lime-ui"),
  path.resolve(repoRoot, "packages/lime-interaction-system"),
  path.resolve(repoRoot, "packages/lime-web-bridge"),
];

const SINGLETONS = new Set([
  "react",
  "react-dom",
  "react-native",
  "react-native-reanimated",
  "react-native-gesture-handler",
  "react-native-safe-area-context",
  "react-native-svg",
  "react-native-webview",
]);

const appModules = path.resolve(projectRoot, "node_modules");
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const root = moduleName.split("/")[0];
  if (SINGLETONS.has(root)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(appModules, "__pin__.js") },
      moduleName,
      platform,
    );
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
