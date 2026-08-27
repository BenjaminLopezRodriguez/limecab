import { cn } from "@/lib/utils";

/**
 * Top-down car glyph for the map. Drawn pointing north so `heading` is
 * degrees clockwise from north — the same convention as a compass / GeoJSON.
 */
export function CarMarker({
  heading = 0,
  size = "md",
  className,
}: {
  heading?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const large = size === "md";
  return (
    <span
      aria-hidden="true"
      className={cn("block", large ? "h-10 w-6" : "h-7 w-4", className)}
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <svg
        viewBox="0 0 32 56"
        className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
      >
        <rect x="7" y="3" width="18" height="50" rx="7" fill="#1c1a16" />
        <rect x="8.5" y="5" width="15" height="46" rx="6" fill="#c8f031" />
        <rect
          x="10"
          y="12"
          width="12"
          height="12"
          rx="2.5"
          fill="#1c1a16"
          fillOpacity="0.38"
        />
        <rect
          x="10"
          y="32"
          width="12"
          height="10"
          rx="2"
          fill="#1c1a16"
          fillOpacity="0.28"
        />
        <rect
          x="9"
          y="6.5"
          width="14"
          height="3"
          rx="1.2"
          fill="#f4f1ea"
          fillOpacity="0.55"
        />
      </svg>
    </span>
  );
}
