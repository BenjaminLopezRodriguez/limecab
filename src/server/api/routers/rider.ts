import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { normalizePhone } from "@/lib/limecab/phone";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { users, verificationTokens } from "@/server/db/schema";
import { replaceOtp } from "@/server/limecab/otp";

const phoneInput = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[0-9+().\-\s]+$/, "Use a phone number.");

export const riderRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerifiedAt: true,
        identityStatus: true,
        identityLegalName: true,
        identitySubmittedAt: true,
      },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),

  requestPhoneCode: protectedProcedure
    .input(z.object({ phone: phoneInput }))
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      if (!phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use a phone number.",
        });
      }
      const identifier = `phone:${ctx.session.user.id}`;
      const token = await replaceOtp(ctx.db, identifier);
      await ctx.db
        .update(users)
        .set({
          phone,
          phoneVerifiedAt: null,
        })
        .where(eq(users.id, ctx.session.user.id));

      return {
        sent: true,
        // No SMS in this build — the code is returned so verification can
        // actually complete. Do not surface this in a production SMS flow.
        code: token,
      };
    }),

  confirmPhone: protectedProcedure
    .input(z.object({ code: z.string().trim().min(4).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const identifier = `phone:${ctx.session.user.id}`;
      const row = await ctx.db.query.verificationTokens.findFirst({
        where: and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, input.code),
        ),
      });
      if (!row || row.expires < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That code is wrong or expired.",
        });
      }
      await ctx.db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, input.code),
          ),
        );
      const [updated] = await ctx.db
        .update(users)
        .set({ phoneVerifiedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id))
        .returning({
          phone: users.phone,
          phoneVerifiedAt: users.phoneVerifiedAt,
        });
      return updated;
    }),

  submitIdentity: protectedProcedure
    .input(
      z.object({
        legalName: z.string().trim().min(2).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({
          identityLegalName: input.legalName,
          identityStatus: "pending",
          identitySubmittedAt: new Date(),
        })
        .where(eq(users.id, ctx.session.user.id))
        .returning({
          identityStatus: users.identityStatus,
          identityLegalName: users.identityLegalName,
        });
      return updated;
    }),
});
