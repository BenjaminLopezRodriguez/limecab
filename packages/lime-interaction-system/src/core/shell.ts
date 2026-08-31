/**
 * Chrome intent sits ADJACENT to the scene, never inside it.
 * "this scene wants tabs hidden" != "this scene renders tabs".
 *
 * Native navigation containers own header / tab bar / status bar / home indicator above the
 * scene renderer. Production already reads this way: tabs hide inside a task
 * (limecab-shell.tsx:74); driver drops chrome entirely (driver-chrome.tsx:28).
 */
export type ChromeMode = "none" | "standard" | "route" | "driver";

export interface ShellIntent {
  navigationVisibility?: "visible" | "hidden";
  topChrome?: ChromeMode;
  bottomChrome?: ChromeMode;
}
