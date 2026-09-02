/**
 * Default resolution: web. Metro picks `adapter.native.tsx` ahead of this file on Expo /
 * React Native; every other bundler and tsc land here. Components import `../platform/adapter`
 * (extensionless) so that swap can happen.
 */
export * from "./web.tsx";
