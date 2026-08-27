"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

export function VerifySettings() {
  const me = api.rider.me.useQuery();
  if (!me.data) {
    return (
      <div aria-busy="true" className="mt-7">
        <div className="bg-muted h-28 animate-pulse rounded-2xl" />
        <span className="sr-only">Loading verification</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PhoneVerify
        phone={me.data.phone}
        verified={Boolean(me.data.phoneVerifiedAt)}
      />
      <IdentityVerify
        legalName={me.data.identityLegalName}
        status={me.data.identityStatus}
      />
    </div>
  );
}

function PhoneVerify({
  phone,
  verified,
}: {
  phone: string | null;
  verified: boolean;
}) {
  const utils = api.useUtils();
  const [number, setNumber] = useState(phone ?? "");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const request = api.rider.requestPhoneCode.useMutation({
    onSuccess: (result) => {
      setPreview(result.code);
      setCode("");
    },
  });
  const confirm = api.rider.confirmPhone.useMutation({
    onSuccess: async () => {
      setPreview(null);
      setCode("");
      await utils.rider.me.invalidate();
    },
  });

  if (verified) {
    return (
      <section>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Phone</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Verified · {phone}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Phone</h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Soft requirement — you can still ride. A verified number is how we reach
        you about a trip.
      </p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (preview) {
            confirm.mutate({ code });
            return;
          }
          request.mutate({ phone: number });
        }}
      >
        <label className="block">
          <span className="text-[15px] font-medium tracking-tight">
            Mobile number
          </span>
          <Input
            type="tel"
            autoComplete="tel"
            required
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="mt-2"
            disabled={Boolean(preview)}
          />
        </label>
        {preview ? (
          <label className="block">
            <span className="text-[15px] font-medium tracking-tight">
              Confirmation code
            </span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-2"
            />
            <span className="text-muted-foreground mt-2 block text-sm">
              This build has no SMS. Enter {preview}.
            </span>
          </label>
        ) : null}
        {(request.error ?? confirm.error) ? (
          <p role="alert" className="text-destructive text-sm">
            {(request.error ?? confirm.error)?.message}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={request.isPending || confirm.isPending}
          aria-busy={request.isPending || confirm.isPending || undefined}
        >
          {preview
            ? confirm.isPending
              ? "Confirming…"
              : "Confirm"
            : request.isPending
              ? "Sending…"
              : "Send code"}
        </Button>
      </form>
    </section>
  );
}

function IdentityVerify({
  legalName,
  status,
}: {
  legalName: string | null;
  status: "unverified" | "pending" | "verified";
}) {
  const utils = api.useUtils();
  const [name, setName] = useState(legalName ?? "");
  const submit = api.rider.submitIdentity.useMutation({
    onSuccess: async () => {
      await utils.rider.me.invalidate();
    },
  });

  return (
    <section>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
        Government ID
      </h2>
      {status === "verified" ? (
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Verified · {legalName}
        </p>
      ) : null}
      {status === "pending" ? (
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Submitted as {legalName}. A review usually takes a day. You can keep
          riding.
        </p>
      ) : null}
      {status === "unverified" ? (
        <>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Optional, but we ask for it. Name as it appears on your ID.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit.mutate({ legalName: name });
            }}
          >
            <label className="block">
              <span className="text-[15px] font-medium tracking-tight">
                Legal name
              </span>
              <Input
                autoComplete="name"
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2"
              />
            </label>
            {submit.error ? (
              <p role="alert" className="text-destructive text-sm">
                {submit.error.message}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={submit.isPending}
              aria-busy={submit.isPending || undefined}
            >
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
