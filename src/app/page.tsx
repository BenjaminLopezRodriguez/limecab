import { LimeCabApp } from "@/components/limecab/limecab-app";

export default function Home() {
  return (
    <main
      className="bg-background text-foreground"
      style={{ "--service-app-chrome": "3.25rem" } as React.CSSProperties}
    >
      <header className="flex h-[3.25rem] items-center px-5 md:px-6">
        <span className="text-[19px] font-semibold tracking-[-0.03em]">
          Lime<span className="text-primary">Cab</span>
        </span>
      </header>
      <LimeCabApp />
    </main>
  );
}
