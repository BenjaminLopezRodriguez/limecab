import { redirect } from "next/navigation";

/** `/partner/stay` → Places product (rooms + parking supply). */
export default function PartnerStayRedirectPage() {
  redirect("/partner/places");
}
