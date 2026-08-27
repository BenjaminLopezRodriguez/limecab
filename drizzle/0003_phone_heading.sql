ALTER TABLE "limecab_user" DROP CONSTRAINT IF EXISTS "limecab_user_phone_unique";--> statement-breakpoint
UPDATE "limecab_user" AS u
SET phone = NULL
WHERE u.phone IS NOT NULL
  AND u.id NOT IN (
    SELECT DISTINCT ON (phone) id
    FROM "limecab_user"
    WHERE phone IS NOT NULL
    ORDER BY phone, id
  );--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "limecab_user_phone_unique" ON "limecab_user" ("phone");--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "headingAddress" varchar(512);--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "headingLatitude" double precision;--> statement-breakpoint
ALTER TABLE "limecab_driver" ADD COLUMN IF NOT EXISTS "headingLongitude" double precision;
