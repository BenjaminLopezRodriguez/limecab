import { createServer } from "node:http";

import { createDb, migrate } from "./db.ts";
import { route } from "./http/routes.ts";
import { GooglePlacesProvider } from "./providers/google.ts";
import { MapboxProvider } from "./providers/mapbox.ts";

const sql = createDb();
if (!sql) {
  console.info("[spatial] DATABASE_URL missing");
  process.exit(1);
}
await migrate(sql);

// Google first, Mapbox as the fallback that still warms the same tables.
const providers = [new GooglePlacesProvider(), new MapboxProvider()];
const port = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  void route(req, res, { sql, providers });
});
server.listen(port, () => console.info(`[spatial] listening on ${port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void sql.end({ timeout: 5 }).then(() => process.exit(0)));
  });
}
