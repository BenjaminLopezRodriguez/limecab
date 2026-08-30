import { redirect } from "next/navigation";

import { DriverSubpage } from "@/components/limecab/profile";
import { VehicleManager } from "@/components/limecab/vehicle-manager";
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
      title="Vehicles"
    >
      <VehicleManager
        driverId={driver.id}
        active={{
          make: driver.vehicleMake,
          model: driver.vehicleModel,
          color: driver.vehicleColor,
          plate: driver.vehiclePlate,
        }}
      />
    </DriverSubpage>
  );
}
