export {
  AdaptiveSurface,
  useAdaptiveSurface,
  useOptionalAdaptiveSurface,
  isSurfacePresentation,
  type SurfacePresentation,
  type SurfaceEntry,
  type SurfaceProgressInput,
  type TransitionIntent,
} from "@/components/service-app/adaptive-surface";
export { OverlaySurface } from "@/components/service-app/overlay-surface";
export { ServiceAppShell } from "@/components/service-app/service-app-shell";
export { ServiceSheet, SheetActions } from "@/components/service-app/service-sheet";
export {
  TaskScene,
  TaskSceneHeader,
  PrimaryAction,
} from "@/components/service-app/task-scene";
export {
  ServiceMap,
  MapAdapterProvider,
  placeholderMapAdapter,
} from "@/components/service-app/service-map";
export { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
export { LocationTrigger } from "@/components/service-app/location-trigger";
export { MapRouteBar } from "@/components/service-app/map-route-bar";
export { LocationSearch } from "@/components/service-app/location-search";
export { LocationSearchScene } from "@/components/service-app/location-search-scene";
export { LocationPinScene } from "@/components/service-app/location-pin-scene";
export { SavedPlaces } from "@/components/service-app/saved-places";
export { ServiceGrid } from "@/components/service-app/service-grid";
export {
  ChoiceList,
  ChoiceRow,
  ChoiceStaticRow,
  ChoiceLinkRow,
  ChoiceGlyph,
  ChoiceCopy,
} from "@/components/service-app/choice-list";
export { QuotePanel } from "@/components/service-app/quote-panel";
export {
  ServiceStatusPanel,
  ServiceProgress,
  ServiceMilestones,
  ProviderEta,
} from "@/components/service-app/service-status";
export {
  LiveSheetHeader,
  LiveSheetIdentity,
  LiveSheetDock,
  LiveMetric,
  type LiveMetricValue,
} from "@/components/service-app/live-sheet";
export {
  SurfaceManagerProvider,
  ManagedSurface,
  SurfaceManagerDebug,
  useSurfaceManager,
  useOptionalSurfaceManager,
  useSurface,
} from "@/components/service-app/surface-manager";
export {
  createSurfaceManager,
  describeSurfaceLayout,
  initialLayout,
  initialSurfaceManagerState,
  reduceSurfaceManager,
  surfaceLayoutViolations,
  SURFACE_MOTION_MS,
  type SurfaceAction,
  type SurfaceDefinition,
  type SurfaceEmphasis,
  type SurfaceInteraction,
  type SurfaceLayout,
  type SurfaceManagerConfig,
  type SurfaceManagerState,
  type SurfaceMotionIntent,
  type SurfaceRecipe,
  type SurfaceRole,
  type SurfaceState,
  type SurfaceTarget,
} from "@/lib/service-app/surface-manager";
export { ConfirmActionSurface } from "@/components/service-app/confirm-action-surface";
export { ConfigureScene } from "@/components/service-app/configure-scene";
export { ProviderCard } from "@/components/service-app/provider-card";
export { CompletionPanel } from "@/components/service-app/completion-panel";
export { SpatialEtaMarker } from "@/components/service-app/spatial-eta-marker";
export {
  FixedMarker,
  FloatingMarker,
  FloatingRouteMarker,
  LocationPuck,
  Needle,
} from "@/components/service-app/map-marker";
export { MapPointMarker } from "@/components/service-app/map-point-marker";
export {
  SurfaceSkeleton,
  SurfaceSkeletonList,
} from "@/components/service-app/surface-skeleton";
export {
  defaultOptionValues,
  summarizeOptions,
  type ServiceOption,
  type ServiceOptionValue,
  type ServiceOptionValues,
} from "@/lib/service-app/options";
