import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DriverChrome } from "@/components/limecab/driver-chrome";
import { auth } from "@/server/auth";

/**
 * Driver routes are their own app: a session gate, and chrome that depends on
 * whether the route is the duty session or account paperwork. The rider tab
 * bar is suppressed by the shell for this segment, so nothing here fights it.
 */
export default async function DriverLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <DriverChrome initial={(session.user.name ?? "D").charAt(0).toUpperCase()}>
      {children}
    </DriverChrome>
  );
}
