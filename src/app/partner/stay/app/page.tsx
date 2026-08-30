import { redirect } from "next/navigation";

/** Legacy path — use `/partner/places/app`. */
export default function PartnerStayAppRedirectPage() {
  redirect("/partner/places/app");
}
