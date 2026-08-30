import { redirect } from "next/navigation";

/**
 * Freeze A: `/driver` is the one road app. Freight is a capability on it,
 * unlocked by carrier fleet membership — not a second driver product.
 * Finding and booking loads is dispatch and lives in the carrier portal.
 */
export default function FreightDriverPage() {
  redirect("/driver");
}
