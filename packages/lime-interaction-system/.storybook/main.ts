import type { StorybookConfig } from "@storybook/react-vite";

/**
 * react-vite, deliberately NOT @storybook/nextjs.
 * next.config.js:6 does `import "./src/env.js"`, and DATABASE_URL is the one
 * unconditionally-required variable (env.js:20) — the Next builder would hard-fail here.
 * The lab must boot with no database, no auth, no Stripe, no Mapbox token, no seed data.
 */
const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  addons: [],
};
export default config;
