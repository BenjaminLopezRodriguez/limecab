import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { normalizePhone, signInOtpId } from "@/lib/limecab/phone";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { replaceOtp } from "@/server/limecab/otp";

export const loginRouter = createTRPCRouter({
  requestPhoneCode: publicProcedure
    .input(z.object({ phone: z.string().trim().min(7).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      if (!phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use a phone number.",
        });
      }
      const token = await replaceOtp(ctx.db, signInOtpId(phone));
      return {
        sent: true as const,
        phone,
        // No SMS in this build — the code is returned so sign-in can complete.
        code: token,
      };
    }),
});
