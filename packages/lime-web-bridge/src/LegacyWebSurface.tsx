import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";
import type { LegacyWebSurfaceProps, WebBridgeEvent } from "./types.ts";

/**
 * TEMPORARY MIGRATION ADAPTER — app-level disposable bridge to production web.
 *
 * Not SurfacePresentation, not NativeSceneRenderer, not SurfaceManager.
 * Composition glue at the application root for states not yet implemented natively.
 */

const DEFAULT_BASE_URL = "http://localhost:3100";

export function resolveLimeWebBaseUrl(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.EXPO_PUBLIC_LIME_WEB_BASE_URL : undefined;
  const base = (fromEnv ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return base;
}

function parseBridgeMessage(raw: string): WebBridgeEvent | null {
  try {
    const data = JSON.parse(raw) as { type?: string; path?: string };
    if (data.type === "navigation" && typeof data.path === "string") {
      return { type: "navigation", path: data.path };
    }
    if (data.type === "ride.requested") return { type: "ride.requested" };
    if (data.type === "driver.offerAccepted") return { type: "driver.offerAccepted" };
    if (data.type === "close") return { type: "close" };
    return null;
  } catch {
    return null;
  }
}

export function LegacyWebSurface({ path, product, onEvent }: LegacyWebSurfaceProps) {
  const uri = useMemo(() => {
    const base = resolveLimeWebBaseUrl();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }, [path]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const bridge = parseBridgeMessage(event.nativeEvent.data);
      if (bridge) onEvent?.(bridge);
    },
    [onEvent],
  );

  const injectedBefore = useMemo(
    () => `
      (function () {
        window.LimeNativeBridge = {
          product: ${JSON.stringify(product)},
          post: function (payload) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          }
        };
      })();
      true;
    `,
    [product],
  );

  return (
    <View style={styles.root}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={injectedBefore}
        allowsBackForwardNavigationGestures
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webview: { flex: 1 },
});
