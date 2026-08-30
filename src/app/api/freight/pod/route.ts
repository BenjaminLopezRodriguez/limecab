import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getCarrierMembership, loadById } from "@/server/freight/authz";
import { storePodBlob } from "@/server/freight/pod-blob";

/**
 * Carry a proof-of-delivery photo from the cab to durable storage.
 *
 * POST /api/freight/pod  multipart { loadId, file } →
 *   { storageReference: string | null, stored: boolean }
 *
 * tRPC cannot take a file, so the bytes come through a route and the
 * *record* stays where it already lives: the caller hands the returned
 * reference to `freight.submitPod`, which writes the `POD` document row and
 * moves the load. Writing the row here too would file the same POD twice.
 *
 * Authorization mirrors `freight.uploadDocument` — shipper, assigned driver,
 * or a member of the load's carrier.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Need a photo" }, { status: 400 });
  }

  const loadId = form.get("loadId");
  const file = form.get("file");
  if (typeof loadId !== "string" || !loadId.trim() || !(file instanceof File)) {
    return NextResponse.json({ error: "Need a load and a photo" }, { status: 400 });
  }

  let load: Awaited<ReturnType<typeof loadById>>;
  try {
    load = await loadById(db, loadId);
  } catch {
    return NextResponse.json({ error: "Load not found" }, { status: 404 });
  }

  const isShipper = load.shipperUserId === userId;
  const isDriver = load.assignedDriverUserId === userId;
  const membership = load.carrierId
    ? await getCarrierMembership(db, userId, load.carrierId)
    : null;
  if (!isShipper && !isDriver && !membership) {
    return NextResponse.json({ error: "Not your load" }, { status: 403 });
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo must be an image under 8 MB" },
      { status: 413 },
    );
  }
  const mediaType = file.type || "image/jpeg";
  if (!mediaType.startsWith("image/")) {
    return NextResponse.json({ error: "POD must be a photo" }, { status: 415 });
  }

  const stored = await storePodBlob({
    loadId: load.id,
    bytes: new Uint8Array(await file.arrayBuffer()),
    mediaType,
    filename: file.name || "pod.jpg",
  });

  // Honest-empty: no blob store configured means no photo was kept. Say so
  // rather than handing back a reference that resolves to nothing.
  return NextResponse.json({
    storageReference: stored?.url ?? null,
    stored: stored !== null,
  });
}
