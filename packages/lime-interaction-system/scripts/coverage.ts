#!/usr/bin/env node
/**
 * Extraction coverage report — compares production component inventory against Storybook representation.
 */
import { readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkg, "../..");

type Entry = { file: string; class: string; storybook?: string };

const inventory: Record<string, Entry[]> = {
  "service-app": [
    { file: "adaptive-surface.tsx", class: "ADAPT", storybook: "Surfaces (via SurfaceSheet)" },
    { file: "choice-list.tsx", class: "COPY", storybook: "Primitives/ChoiceList" },
    { file: "completion-panel.tsx", class: "COPY", storybook: "Primitives/Completion" },
    { file: "configure-scene.tsx", class: "COPY", storybook: "Lists & Choices/Configure" },
    { file: "confirm-action-surface.tsx", class: "ADAPT", storybook: "Primitives/Confirmation" },
    { file: "live-sheet.tsx", class: "COPY", storybook: "Primitives/Status" },
    { file: "location-pin-marker.tsx", class: "COPY", storybook: "Location/PinConfirm" },
    { file: "location-pin-scene.tsx", class: "COPY", storybook: "Location/PinConfirm" },
    { file: "location-search-scene.tsx", class: "ADAPT", storybook: "Location/SearchScene" },
    { file: "location-search.tsx", class: "ADAPT", storybook: "Location/*" },
    { file: "location-trigger.tsx", class: "COPY", storybook: "Primitives/LocationTrigger" },
    { file: "map-marker.tsx", class: "COPY", storybook: "Map/Pins" },
    { file: "map-point-marker.tsx", class: "ADAPT", storybook: "Map/Gallery" },
    { file: "map-route-bar.tsx", class: "COPY", storybook: "Map/RouteBar" },
    { file: "map-overlay.ts", class: "IGNORE", storybook: "— (occlusion policy)" },
    { file: "mapbox-adapter.tsx", class: "REFERENCE" },
    { file: "mapbox-canvas.tsx", class: "ADAPT", storybook: "Map (mock renderer)" },
    { file: "car-marker.tsx", class: "COPY", storybook: "Map/CarHeading" },
    { file: "pickup-point-marker.tsx", class: "COPY", storybook: "Map/PickupMarker" },
    { file: "rest-stop-marker.tsx", class: "COPY", storybook: "Map/RestStop" },
    { file: "spatial-eta-marker.tsx", class: "COPY", storybook: "Map/EtaStates" },
    { file: "overlay-surface.tsx", class: "ADAPT", storybook: "UI/InterruptDrawer" },
    { file: "provider-card.tsx", class: "COPY", storybook: "Primitives/Status" },
    { file: "quote-panel.tsx", class: "COPY", storybook: "Primitives/Quote" },
    { file: "saved-places.tsx", class: "COPY", storybook: "Lists & Choices/SavedPlaces*" },
    { file: "service-app-shell.tsx", class: "ADAPT", storybook: "Rider/RideSelectSpatial" },
    { file: "service-grid.tsx", class: "COPY", storybook: "Lists & Choices/ServiceGrid*" },
    { file: "service-map.tsx", class: "ADAPT", storybook: "SceneRenderer mock map" },
    { file: "service-sheet.tsx", class: "ADAPT", storybook: "web/SurfaceSheet" },
    { file: "service-status.tsx", class: "ADAPT", storybook: "Status/*" },
    { file: "surface-manager.tsx", class: "ADAPT", storybook: "core/surface-manager" },
    { file: "surface-skeleton.tsx", class: "COPY", storybook: "Primitives/Loading" },
    { file: "task-scene.tsx", class: "ADAPT", storybook: "UI/Dialog" },
    { file: "index.ts", class: "IGNORE" },
  ],
  ui: [
    { file: "button.tsx", class: "COPY", storybook: "UI/ButtonVariants" },
    { file: "dialog.tsx", class: "COPY", storybook: "UI/Dialog" },
    { file: "drawer.tsx", class: "COPY", storybook: "UI/Drawer" },
    { file: "icon.tsx", class: "COPY", storybook: "UI (glyph placeholders)" },
    { file: "input.tsx", class: "COPY", storybook: "UI/InputStates" },
    { file: "progress.tsx", class: "COPY", storybook: "UI/Progress" },
    { file: "separator.tsx", class: "COPY", storybook: "UI/Separator" },
  ],
  limecab: [
    { file: "limecab-app.tsx", class: "REFERENCE" },
    { file: "driver-app.tsx", class: "REFERENCE" },
    { file: "limecab-shell.tsx", class: "REFERENCE" },
    { file: "surfaces.ts", class: "REFERENCE" },
    { file: "driver-surfaces.ts", class: "REFERENCE" },
    { file: "limecab-home-scene.tsx", class: "ADAPT", storybook: "Rider/Home" },
    { file: "limecab-ride-select-scene.tsx", class: "ADAPT", storybook: "Rider/RideSelect*" },
    { file: "limecab-quote-scene.tsx", class: "ADAPT", storybook: "Rider/Quote" },
    { file: "limecab-status-scene.tsx", class: "ADAPT", storybook: "Rider/Matching|DriverAssigned|InRide" },
    { file: "limecab-complete-scene.tsx", class: "ADAPT", storybook: "Rider/Completion" },
    { file: "limecab-confirm-pickup-scene.tsx", class: "ADAPT", storybook: "Rider/ConfirmPickup" },
    { file: "limecab-configure-scene.tsx", class: "ADAPT", storybook: "Lists & Choices/Configure" },
    { file: "limecab-when-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-shop-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-help-kind-scene.tsx", class: "COPY", storybook: "— (P2)" },
    { file: "limecab-spaces-kind-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-spaces-select-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-station-duration-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-station-select-scene.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-interrupts.tsx", class: "ADAPT", storybook: "Flows/Rider interrupt" },
    { file: "limecab-assist-compose.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "limecab-assist-results.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "assist-textcon.tsx", class: "COPY", storybook: "— (P2)" },
    { file: "limecab-search-input.tsx", class: "ADAPT", storybook: "Location/*" },
    { file: "limecab-search-results.tsx", class: "ADAPT", storybook: "Location/*" },
    { file: "limecab-voice-banner.tsx", class: "ADAPT", storybook: "Status/Voice" },
    { file: "limecab-trip-pill.tsx", class: "REFERENCE", storybook: "Status/TripPill" },
    { file: "limecab-parts.tsx", class: "COPY", storybook: "Profile/TipPanel" },
    { file: "limecab-save-place.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "trip-chat-thread.tsx", class: "ADAPT", storybook: "Profile/TripChat" },
    { file: "profile.tsx", class: "COPY", storybook: "Profile/*" },
    { file: "profile-settings.tsx", class: "COPY", storybook: "Profile/Settings" },
    { file: "driver-chrome.tsx", class: "REFERENCE" },
    { file: "driver-tabs.tsx", class: "COPY", storybook: "Driver/Tabs" },
    { file: "driver-scenes.tsx", class: "ADAPT", storybook: "Driver/*" },
    { file: "driver-earnings-trip-detail.tsx", class: "ADAPT", storybook: "Driver/EarningsDetail" },
    { file: "driver-preferences.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "driver-freight-scene.tsx", class: "ADAPT", storybook: "Freight/*" },
    { file: "driver-freight-interrupts.tsx", class: "ADAPT", storybook: "Flows/Freight" },
    { file: "driver-help-optin.tsx", class: "ADAPT", storybook: "— (P2)" },
    { file: "driver-safety-toolkit.tsx", class: "REFERENCE" },
    { file: "vehicle-manager.tsx", class: "ADAPT", storybook: "Profile/Vehicle" },
    { file: "support-form.tsx", class: "ADAPT", storybook: "Profile/Support" },
    { file: "saved-places-editor.tsx", class: "REFERENCE" },
    { file: "phone-signin.tsx", class: "REFERENCE" },
    { file: "verify-settings.tsx", class: "REFERENCE" },
  ],
  freight: [
    { file: "freight-api.ts", class: "IGNORE" },
    { file: "freight-parts.tsx", class: "ADAPT", storybook: "Freight/*" },
    { file: "shipper/freight-shipper-app.tsx", class: "REFERENCE" },
    { file: "shipper/freight-shipper-shell.tsx", class: "REFERENCE" },
    { file: "shipper/freight-shipper-scenes.tsx", class: "ADAPT", storybook: "Freight/ShipperQuote" },
    { file: "shipper/freight-shipper-shipments.tsx", class: "REFERENCE", storybook: "Freight/Shipments" },
    { file: "shipper/freight-shipper-surfaces.ts", class: "REFERENCE" },
    { file: "carrier/freight-portal-shell.tsx", class: "REFERENCE", storybook: "Freight/DeskShell" },
    { file: "carrier/freight-portal-search.tsx", class: "REFERENCE", storybook: "Freight/DeskSearch" },
    { file: "carrier/freight-portal-my-loads.tsx", class: "REFERENCE", storybook: "Freight/DeskMyLoads" },
    { file: "carrier/freight-portal-load-detail.tsx", class: "REFERENCE", storybook: "Freight/DeskLoadDetail" },
    { file: "carrier/freight-portal-lanes.tsx", class: "REFERENCE", storybook: "Freight/DeskLanes" },
    { file: "carrier/freight-portal-fleet.tsx", class: "REFERENCE", storybook: "Freight/DeskFleet" },
    { file: "carrier/freight-carrier-gate.tsx", class: "REFERENCE" },
  ],
  partner: [
    { file: "partner-places-app.tsx", class: "REFERENCE" },
    { file: "partner-places-chrome.tsx", class: "REFERENCE" },
    { file: "partner-places-tabs.tsx", class: "COPY", storybook: "Partner/Tabs" },
    { file: "partner-places-scenes.tsx", class: "ADAPT", storybook: "Partner/*" },
  ],
};

function summarize(dir: string, entries: Entry[]) {
  const visual = entries.filter((e) => !["IGNORE", "REFERENCE"].includes(e.class) || e.storybook);
  const represented = visual.filter((e) => e.storybook && !e.storybook.startsWith("—"));
  const p2 = visual.filter((e) => e.storybook?.startsWith("—"));
  const internal = entries.filter((e) => e.class === "IGNORE");
  const reference = entries.filter((e) => e.class === "REFERENCE" && !e.storybook);
  return { dir, total: entries.length, represented: represented.length, p2: p2.length, internal: internal.length, reference: reference.length };
}

console.log("Storybook coverage\n------------------");
for (const [dir, entries] of Object.entries(inventory)) {
  const s = summarize(dir, entries);
  const visualCount = s.total - s.internal - s.reference;
  console.log(`${dir}: ${s.represented} / ${visualCount} represented · ${s.p2} P2 pending · ${s.internal} internal · ${s.reference} reference-only`);
}

const storiesDir = resolve(pkg, "src/stories");
const storyCount = readdirSync(storiesDir).filter((f) => f.endsWith(".stories.tsx")).length;
console.log(`\nStory files: ${storyCount}`);
console.log(`Package exists: ${existsSync(pkg)}`);
