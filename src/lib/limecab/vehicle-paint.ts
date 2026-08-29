/**
 * Tailwind fill for a named vehicle colour. Returns null when the name
 * does not map — a mute grey rectangle is not a colour cue.
 */
export function vehiclePaintClass(color: string): string | null {
  const key = color.trim().toLowerCase();
  if (key.includes("black") || key.includes("charcoal")) return "bg-foreground";
  if (key.includes("white") || key.includes("ivory") || key.includes("pearl")) {
    return "bg-card ring-border ring-1";
  }
  if (key.includes("slate")) return "bg-slate-500";
  if (key.includes("silver") || key.includes("grey") || key.includes("gray")) {
    return "bg-muted-foreground/55";
  }
  if (key.includes("red") || key.includes("maroon")) return "bg-destructive";
  if (key.includes("navy") || key.includes("midnight")) return "bg-blue-900";
  if (key.includes("blue")) return "bg-blue-600";
  if (key.includes("green") || key.includes("lime")) return "bg-lime";
  if (key.includes("gold") || key.includes("yellow")) return "bg-amber-400";
  if (key.includes("orange") || key.includes("copper")) return "bg-orange-500";
  if (key.includes("brown") || key.includes("tan") || key.includes("beige")) {
    return "bg-amber-800";
  }
  if (key.includes("purple") || key.includes("violet")) return "bg-violet-600";
  return null;
}
