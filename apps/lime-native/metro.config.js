// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");

/**
 * `@lime/ui` and `@lime/interaction-system` are consumed as local symlinks and ship raw
 * TypeScript, so Metro has to watch their sources and transform them like app code.
 *
 * This repository is deliberately NOT a workspace — the Next app at the root owns its own
 * dependency tree — so the two package folders are named explicitly rather than discovered
 * from a workspace root.
 */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(repoRoot, "packages/lime-ui"),
  path.resolve(repoRoot, "packages/lime-interaction-system"),
];

/**
 * Each linked package carries its own devDependency copies of react / react-native for
 * typechecking. Metro resolves from the requesting file's real path, so a component inside
 * `packages/lime-ui/src` would find that package's React and put two of them in one bundle —
 * which breaks hooks, context and the theme provider in ways that look like unrelated bugs.
 *
 * Only these singletons are pinned. Turning hierarchical lookup off wholesale also works for
 * the packages but breaks Expo's own nested dependencies (expo-asset and friends resolve from
 * inside `node_modules/expo/node_modules`), so the narrower fix is the correct one.
 */
const SINGLETONS = new Set([
  "react",
  "react-dom",
  "react-native",
  "react-native-reanimated",
  "react-native-gesture-handler",
  "react-native-safe-area-context",
  "react-native-svg",
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
