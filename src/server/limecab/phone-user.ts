import { eq } from "drizzle-orm";

import {
  formatPhone,
  phoneEmail,
} from "@/lib/limecab/phone";
import { db } from "@/server/db";
import { accounts, users } from "@/server/db/schema";

export async function findOrCreatePhoneUser(phone: string) {
  const existing = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });
  if (existing) {
    if (!existing.phoneVerifiedAt) {
      await db
        .update(users)
        .set({ phoneVerifiedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: phoneEmail(phone),
      name: formatPhone(phone),
      phone,
      phoneVerifiedAt: new Date(),
      emailVerified: null,
    })
    .returning();
  if (!created) return null;

  await db.insert(accounts).values({
    userId: created.id,
    type: "email",
    provider: "phone",
    providerAccountId: phone,
  });

  return created;
}
