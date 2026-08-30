import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/server/auth";

/**
 * Freight is its own product (LimeCabShell bypasses /freight).
 * Session gate only — chrome lives per shipper/carrier segment.
 */
export default async function FreightLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return children;
}
