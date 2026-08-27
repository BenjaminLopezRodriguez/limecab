"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { normalizePhone, signInOtpId } from "@/lib/limecab/phone";
import { signIn } from "@/server/auth";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { consumeOtp } from "@/server/limecab/otp";
import { findOrCreatePhoneUser } from "@/server/limecab/phone-user";

export async function startOAuth(provider: string, callbackUrl: string) {
  await signIn(provider, { redirectTo: callbackUrl ?? "/" });
}

function safeCallback(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${parsed.pathname}${parsed.search}` || "/";
    }
  } catch {
    // fall through
  }
  return "/";
}

export async function startPhoneSignIn(
  phone: string,
  code: string,
  callbackUrl: string,
) {
  const digits = normalizePhone(phone);
  if (!digits) return { error: "Use a phone number." };

  const ok = await consumeOtp(db, signInOtpId(digits), code.trim());
  if (!ok) return { error: "That code is wrong or expired." };

  const user = await findOrCreatePhoneUser(digits);
  if (!user) return { error: "Couldn’t create your account." };

  const sessionToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    sessionToken,
    userId: user.id,
    expires,
  });

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set({
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
    secure,
  });

  redirect(safeCallback(callbackUrl ? callbackUrl : "/"));
}
