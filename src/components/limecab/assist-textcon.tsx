"use client";

import {
  Calendar03Icon,
  Car01Icon,
  FlowerIcon,
  Home01Icon,
  Location01Icon,
  Package01Icon,
  ShoppingBasket01Icon,
  SparklesIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { splitAssistMessage } from "@/lib/limecab/assist-message";
import {
  ASSIST_TEXTCONS,
  resolveAssistTextcon,
  type AssistTextconId,
} from "@/lib/limecab/assist-textcon";
import { cn } from "@/lib/utils";

const ICONS: Record<AssistTextconId, IconSvgElement> = {
  ride: Car01Icon,
  shop: ShoppingBasket01Icon,
  courier: Package01Icon,
  help: Home01Icon,
  reserve: Calendar03Icon,
  assist: SparklesIcon,
  store: Store01Icon,
  place: Location01Icon,
  flowers: FlowerIcon,
};

export { ASSIST_TEXTCONS, resolveAssistTextcon };
export type { AssistTextconId };

/** Service id → icon, same glyphs as the services page / ribbon. */
export const TEXTCON_ICONS = ICONS;

export function AssistTextcon({
  id,
  size = "md",
  className,
}: {
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const entry = resolveAssistTextcon(id) ?? ASSIST_TEXTCONS.assist;
  const icon = ICONS[entry.id] ?? SparklesIcon;
  const small = size === "sm";
  return (
    <span
      role="img"
      aria-label={entry.label}
      title={entry.label}
      className={cn(
        "bg-lime text-lime-foreground inline-flex shrink-0 items-center justify-center rounded-full align-middle",
        small ? "mx-0.5 size-5" : "size-6",
        className,
      )}
    >
      <Icon icon={icon} size={small ? 12 : 14} />
    </span>
  );
}

export function parseAssistMessage(message: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (const [index, segment] of splitAssistMessage(message).entries()) {
    if (segment.type === "text") {
      nodes.push(segment.value);
      continue;
    }
    const entry = resolveAssistTextcon(segment.id);
    if (!entry) continue;
    nodes.push(
      <AssistTextcon key={`${entry.id}-${index}`} id={entry.id} size="sm" />,
    );
  }
  return nodes;
}
