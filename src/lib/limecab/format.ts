import { isCourierProduct } from "@/lib/limecab/courier";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import {
  civilDateInZone,
  DRIVER_TZ,
  mondayCivilDateInZone,
} from "@/lib/limecab/week";

export { civilDateInZone, DRIVER_TZ, mondayCivilDateInZone };

export function productLabel(productId: string): string {
  if (isCourierProduct(productId)) return "Courier";
  return RIDE_PRODUCTS.find((product) => product.id === productId)?.name ?? "Lime";
}

/** "Yesterday · 6:42 PM" — no date library, just the platform. */
export function formatTripWhen(date: Date): string {
  const today = new Date();
  const days = Math.round(
    (new Date(today.toDateString()).getTime() -
      new Date(date.toDateString()).getTime()) /
      86_400_000,
  );
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;
  const day =
    days < 7
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day} · ${time}`;
}

export function tripStatusLabel(status: string, courier: boolean): string {
  if (status === "cancelled") return "Cancelled";
  if (status === "complete") return courier ? "Delivered" : "Completed";
  if (status === "in_progress") return courier ? "En route" : "On the way";
  if (status === "arriving") return courier ? "Courier arriving" : "Driver arriving";
  if (status === "matched") return courier ? "Courier assigned" : "Driver assigned";
  if (status === "requested") return courier ? "Finding a courier" : "Finding a driver";
  return "In progress";
}
