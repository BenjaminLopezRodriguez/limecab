import { redirect } from "next/navigation";

import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  VehicleCard,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverVehiclePage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Vehicle"
    >
      <VehicleCard
        make={driver.vehicleMake}
        model={driver.vehicleModel}
        color={driver.vehicleColor}
        plate={driver.vehiclePlate}
      />

      <ProfileSection tone="driver" title="Details">
        <ProfileValueRow label="Make" value={driver.vehicleMake} />
        <ProfileValueRow label="Model" value={driver.vehicleModel} />
        <ProfileValueRow label="Color" value={driver.vehicleColor} />
        <ProfileValueRow label="License plate" value={driver.vehiclePlate} />
      </ProfileSection>
      <ProfileNote>
        Riders match the car, then the plate. Keep this identical to what’s at
        the curb.
      </ProfileNote>
    </DriverSubpage>
  );
}
