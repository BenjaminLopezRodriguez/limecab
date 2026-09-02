/**
 * The product's icon set, as raw SVG element data.
 *
 * Production renders these with `@hugeicons/react` through `src/components/ui/icon.tsx`, at a
 * 24 viewBox with a 1.5 stroke in `currentColor`. Native draws the same paths with the same
 * geometry, so a control that reads as a shield on the web reads as the same shield on device.
 *
 * Only the icons the Ride driver flow actually uses are vendored. The upstream package carries
 * ~14,700 of them and Metro does not reliably tree-shake a barrel that size — pulling the whole
 * set into a phone bundle to draw nine glyphs is the wrong trade. Extracted verbatim from
 * `@hugeicons/core-free-icons`; regenerate rather than hand-edit if one needs to change.
 */

/** `[element, attributes]` pairs, exactly as the upstream package stores them. */
export type IconPaths = readonly (readonly [string, Record<string, string | number>])[];

export const ICONS = {
  Car01: [
    ["path", { d: "M2.5 12L4.5 13", key: "0" }],
    ["path", { d: "M21.5 12.5L19.5 13", key: "1" }],
    ["path", { d: "M8 17.5L8.24567 16.8858C8.61101 15.9725 8.79368 15.5158 9.17461 15.2579C9.55553 15 10.0474 15 11.0311 15H12.9689C13.9526 15 14.4445 15 14.8254 15.2579C15.2063 15.5158 15.389 15.9725 15.7543 16.8858L16 17.5", key: "2" }],
    ["path", { d: "M2 17V19.882C2 20.2607 2.24075 20.607 2.62188 20.7764C2.86918 20.8863 3.10538 21 3.39058 21H5.10942C5.39462 21 5.63082 20.8863 5.87812 20.7764C6.25925 20.607 6.5 20.2607 6.5 19.882V18", key: "3" }],
    ["path", { d: "M17.5 18V19.882C17.5 20.2607 17.7408 20.607 18.1219 20.7764C18.3692 20.8863 18.6054 21 18.8906 21H20.6094C20.8946 21 21.1308 20.8863 21.3781 20.7764C21.7592 20.607 22 19.882V17", key: "4" }],
    ["path", { d: "M4.5 9L5.5883 5.73509C6.02832 4.41505 6.24832 3.75503 6.7721 3.37752C7.29587 3 7.99159 3 9.38304 3H14.617C16.0084 3 16.7041 3 17.2279 3.37752C17.7517 3.75503 17.9717 4.41505 18.4117 5.73509L19.5 9", key: "5" }],
    ["path", { d: "M4.5 9H19.5C20.4572 10.0135 22 11.4249 22 12.9996V16.4702C22 17.0407 21.6205 17.5208 21.1168 17.5875L18 18H6L2.88316 17.5875C2.37955 17.5208 2 17.0407 2 16.4702V12.9996C2 11.4249 3.54279 10.0135 4.5 9Z", key: "6" }],
  ],
  Clock01: [
    ["circle", { cx: "12", cy: "12", r: "10", key: "0" }],
    ["path", { d: "M12 8V12L14 14", key: "1" }],
  ],
  UserMultiple02: [
    ["path", { d: "M18.5 7C18.5 9.20914 16.7091 11 14.5 11C12.2909 11 10.5 9.20914 10.5 7C10.5 4.79086 12.2909 3 14.5 3C16.7091 3 18.5 4.79086 18.5 7Z", key: "0" }],
    ["path", { d: "M8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5", key: "1" }],
    ["path", { d: "M14.5 14C9.8125 14 7 16.5 7 19C7 20.1046 7.83947 21 8.875 21H20.125C21.1605 21 22 20.1046 22 19C22 16.5 19.1875 14 14.5 14Z", key: "2" }],
    ["path", { d: "M4 19.9992H3.5C2.67157 19.9992 2 19.2317 2 18.2849C2 16.673 3.27307 15.0612 5.5 14.3613", key: "3" }],
  ],
  Sparkles: [
    ["path", { d: "M15 2L15.5387 4.39157C15.9957 6.42015 17.5798 8.00431 19.6084 8.46127L22 9L19.6084 9.53873C17.5798 9.99569 15.9957 11.5798 15.5387 13.6084L15 16L14.4613 13.6084C14.0043 11.5798 12.4202 9.99569 10.3916 9.53873L8 9L10.3916 8.46127C12.4201 8.00431 14.0043 6.42015 14.4613 4.39158L15 2Z", key: "0" }],
    ["path", { d: "M7 12L7.38481 13.7083C7.71121 15.1572 8.84275 16.2888 10.2917 16.6152L12 17L10.2917 17.3848C8.84275 17.7112 7.71121 18.8427 7.38481 20.2917L7 22L6.61519 20.2917C6.28879 18.8427 5.15725 17.7112 3.70827 17.3848L2 17L3.70827 16.6152C5.15725 16.2888 6.28879 15.1573 6.61519 13.7083L7 12Z", key: "1" }],
  ],
  CreditCard: [
    ["path", { d: "M2 12C2 8.46252 2 6.69377 3.0528 5.5129C3.22119 5.32403 3.40678 5.14935 3.60746 4.99087C4.86213 4 6.74142 4 10.5 4H13.5C17.2586 4 19.1379 4 20.3925 4.99087C20.5932 5.14935 20.7788 5.32403 20.9472 5.5129C22 6.69377 22 8.46252 22 12C22 15.5375 22 17.3062 20.9472 18.4871C20.7788 18.676 20.5932 18.8506 20.3925 19.0091C19.1379 20 17.2586 20 13.5 20H10.5C6.74142 20 4.86213 20 3.60746 19.0091C3.40678 18.8506 3.22119 18.676 3.0528 18.4871C2 17.3062 2 15.5375 2 12Z", key: "0" }],
    ["path", { d: "M10 16H11.5M14.5 16H18M2 9H22", key: "1" }],
  ],
  Shield01: [["path",{"d":"M18.7088 3.49534C16.8165 2.55382 14.5009 2 12 2C9.4991 2 7.1835 2.55382 5.29116 3.49534C4.36318 3.95706 3.89919 4.18792 3.4496 4.91378C3 5.63965 3 6.34248 3 7.74814V11.2371C3 16.9205 7.54236 20.0804 10.173 21.4338C10.9067 21.8113 11.2735 22 12 22C12.7265 22 13.0933 21.8113 13.8269 21.4338C16.4576 20.0804 21 16.9205 21 11.2371L21 7.74814C21 6.34249 21 5.63966 20.5504 4.91378C20.1008 4.18791 19.6368 3.95706 18.7088 3.49534Z","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}]],
  SlidersHorizontal: [["path",{"d":"M3.99963 5.00055L9.99963 5.00031","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"0"}],["path",{"d":"M12.9996 5.00031L19.9996 5.00031","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M15.9996 9.00031L15.9996 15.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"2"}],["path",{"d":"M9.99963 2.00031L9.99963 8.00031","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"3"}],["path",{"d":"M11.9996 16.0003L11.9996 22.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"4"}],["path",{"d":"M15.9996 12.0001L19.9996 12.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"5"}],["path",{"d":"M3.99963 12.0005L12.9996 12.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"6"}],["path",{"d":"M11.9996 19.0003L19.9996 19.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"7"}],["path",{"d":"M3.99963 19.0005L8.99963 19.0003","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"8"}]],
  Analytics01: [["path",{"d":"M7 17L7 13","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"0"}],["path",{"d":"M12 17L12 7","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M17 17L17 11","stroke":"currentColor","strokeLinecap":"round","strokeWidth":"1.5","key":"2"}],["path",{"d":"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z","stroke":"currentColor","strokeLinejoin":"round","strokeWidth":"1.5","key":"3"}]],
  Steering: [["path",{"d":"M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z","stroke":"currentColor","strokeWidth":"1.5","key":"0"}],["path",{"d":"M18.9181 10.4125C17.9491 10.8367 16.4851 11.218 15.1595 10.7168C13.2638 10 12.2893 10 12 10C11.7107 10 10.7362 10 8.84049 10.7168C7.51492 11.218 6.05092 10.8367 5.08186 10.4125M19 13.2548C16.8546 13.6631 13.6079 14.878 13.5238 19M10.4762 19C10.3921 14.878 7.14544 13.6631 5 13.2548","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M12.008 13L11.999 13","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"2","key":"2"}]],
  Menu01: [["path",{"d":"M4 5L20 5","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}],["path",{"d":"M4 12L20 12","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M4 19L20 19","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"2"}]],
  Home01: [["path",{"d":"M3 11.9896V14.5C3 17.7998 3 19.4497 4.02513 20.4749C5.05025 21.5 6.70017 21.5 10 21.5H14C17.2998 21.5 18.9497 21.5 19.9749 20.4749C21 19.4497 21 17.7998 21 14.5V11.9896C21 10.3083 21 9.46773 20.6441 8.74005C20.2882 8.01237 19.6247 7.49628 18.2976 6.46411L16.2976 4.90855C14.2331 3.30285 13.2009 2.5 12 2.5C10.7991 2.5 9.76689 3.30285 7.70242 4.90855L5.70241 6.46411C4.37533 7.49628 3.71179 8.01237 3.3559 8.74005C3 9.46773 3 10.3083 3 11.9896Z","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}]],
  ArrowRight01: [["path",{"d":"M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}]],
  Wallet01: [["path",{"d":"M14 3H5C3.89543 3 3 3.89543 3 5C3 6.10457 3.89543 7 5 7H18C18 6.07003 18 5.60504 17.8978 5.22354C17.6204 4.18827 16.8117 3.37962 15.7765 3.10222C15.395 3 14.93 3 14 3Z","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}],["path",{"d":"M3 5V15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15V13C21 10.1716 21 8.75736 20.1213 7.87868C19.2426 7 17.8284 7 15 7H7","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M21 12H19C18.535 12 18.3025 12 18.1118 12.0511C17.5941 12.1898 17.1898 12.5941 17.0511 13.1118C17 13.3025 17 13.535 17 14C17 14.465 17 14.6975 17.0511 14.8882C17.1898 15.4059 17.5941 15.8102 18.1118 15.9489C18.3025 16 18.535 16 19 16H21","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"2"}]],
  UserCircle: [["path",{"d":"M18.4984 19.1511C17.3377 17.4018 15.2947 16.2009 12.9313 16.0569L11.9984 16C11.6652 16.0083 11.3547 16.0194 11.0617 16.0325C8.71722 16.1376 6.66598 17.3796 5.5 19.1511","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"0"}],["path",{"d":"M14.9961 10C14.9961 11.6569 13.6529 13 11.9961 13C10.3392 13 8.99609 11.6569 8.99609 10C8.99609 8.34315 10.3392 7 11.9961 7C13.6529 7 14.9961 8.34315 14.9961 10Z","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"1"}],["path",{"d":"M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z","stroke":"currentColor","strokeLinecap":"round","strokeLinejoin":"round","strokeWidth":"1.5","key":"2"}]],
} as const satisfies Record<string, IconPaths>;

export type IconName = keyof typeof ICONS;
