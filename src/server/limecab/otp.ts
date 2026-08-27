import { and, eq } from "drizzle-orm";

import { verificationTokens } from "@/server/db/schema";

type Db = typeof import("@/server/db").db;

export function newOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function replaceOtp(database: Db, identifier: string) {
  const token = newOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await database
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));
  await database.insert(verificationTokens).values({
    identifier,
    token,
    expires,
  });
  return token;
}

export async function consumeOtp(
  database: Db,
  identifier: string,
  token: string,
) {
  const row = await database.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.identifier, identifier),
      eq(verificationTokens.token, token),
    ),
  });
  if (!row || row.expires < new Date()) return false;
  await database
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, token),
      ),
    );
  return true;
}
