import { redirect } from "next/navigation";

/** Old deep link into the retired freight app. The load is on the road app. */
export default function FreightDriverLoadPage() {
  redirect("/driver");
}
