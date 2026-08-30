import { FreightChrome } from "@/components/freight/freight-chrome";
import { FreightDriverLoadDetail } from "@/components/freight/driver/freight-driver-load-detail";

export default async function FreightDriverLoadPage({
  params,
}: {
  params: Promise<{ loadId: string }>;
}) {
  const { loadId } = await params;
  return (
    <FreightChrome product="driver" duty>
      <FreightDriverLoadDetail loadId={loadId} />
    </FreightChrome>
  );
}
