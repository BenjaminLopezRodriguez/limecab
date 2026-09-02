/**
 * Layer: web renderer.
 *
 * Every primitive that used to live here passed the portability test — a greenfield Expo app
 * could use it with no knowledge of this product — so they moved to `@lime/ui`, where they are
 * written against React Native and rendered on DOM through the kit's web adapter.
 *
 * This file is now the cutover seam: the lab's imports resolve unchanged. New lab code should
 * import from `@lime/ui` directly. Anything that fails the portability test is composed from
 * these in the sibling modules (lists, status, location, freight, …) rather than added here.
 */
export {
  ChoiceList,
  ChoiceRow,
  ChoiceGlyph,
  LocationTrigger,
  MapRouteBar,
  RouteRail,
  LiveSheetHeader,
  ProviderCard,
  QuotePanel,
  CompletionPanel,
  PrimaryAction,
  SecondaryAction,
  ConfirmActionSurface,
  SurfaceSkeleton,
} from "@lime/ui";
export type { QuoteLine, RouteStop } from "@lime/ui";
