import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Noto_Sans } from "next/font/google";

import { LimeCabShell } from "@/components/limecab/limecab-shell";
import { auth } from "@/server/auth";
import { TRPCReactProvider } from "@/trpc/react";
import { cn } from "@/lib/utils";

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

const title = "LimeCab";
const description = "Get where you're going. LimeCab rides on demand.";

export const metadata: Metadata = {
  title,
  description,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read once here: the shell greets the rider and gates booking on it.
  const session = await auth();

  return (
    // Dark by default: a ride app is used at night, in a car, and the map
    // reads better against it. There is no theme toggle to honour yet.
    <html
      lang="en"
      className={cn(geist.variable, notoSans.variable, "dark font-sans")}
    >
      <body>
        <a
          href="#limecab-main"
          className="sr-only focus:not-sr-only focus:bg-background focus:ring-ring focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:ring-2"
        >
          Skip to content
        </a>
        {/* The shell owns the ride flow, so it must live above the routes. */}
        <TRPCReactProvider>
          <LimeCabShell
            signedIn={Boolean(session?.user)}
            riderName={session?.user?.name ?? null}
          >
            {children}
          </LimeCabShell>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
