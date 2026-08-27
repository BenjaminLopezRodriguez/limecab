"use client";

import { useState } from "react";

import { startPhoneSignIn } from "@/app/signin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/limecab/phone";
import { api } from "@/trpc/react";

export function PhoneSignIn({ callbackUrl }: { callbackUrl: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [normalized, setNormalized] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const request = api.login.requestPhoneCode.useMutation({
    onSuccess: (result) => {
      setPreview(result.code);
      setNormalized(result.phone);
      setCode("");
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (preview && normalized) {
    return (
      <form
        className="mt-8 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSigningIn(true);
          setError(null);
          void startPhoneSignIn(normalized, code, callbackUrl).then((result) => {
            if (result?.error) {
              setError(result.error);
              setSigningIn(false);
            }
          });
        }}
      >
        <label htmlFor="signin-code" className="text-[15px] font-medium tracking-tight">
          Code
        </label>
        <p className="text-muted-foreground -mt-1 text-sm leading-relaxed">
          This build has no SMS. Enter {preview} for {formatPhone(normalized)}.
        </p>
        <Input
          id="signin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="h-14 text-[17px] tracking-[0.3em]"
          maxLength={8}
        />
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full text-[15px]"
          disabled={signingIn || code.trim().length < 4}
        >
          {signingIn ? "Signing in…" : "Sign in"}
        </Button>
        <button
          type="button"
          className="text-muted-foreground focus-visible:ring-ring min-h-11 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => {
            setPreview(null);
            setNormalized(null);
            setCode("");
            setError(null);
          }}
        >
          Use a different number
        </button>
      </form>
    );
  }

  return (
    <form
      className="mt-8 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        request.mutate({ phone });
      }}
    >
      <label htmlFor="signin-phone" className="text-[15px] font-medium tracking-tight">
        Phone number
      </label>
      <Input
        id="signin-phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="(323) 555-0148"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        className="h-14 text-[17px]"
        required
      />
      {error || request.error ? (
        <p role="alert" className="text-destructive text-sm">
          {error ?? request.error?.message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="h-14 w-full text-[15px]"
        disabled={request.isPending}
      >
        {request.isPending ? "Sending…" : "Continue"}
      </Button>
    </form>
  );
}
