import { pathToFileURL } from "node:url";

import { seedDatabase } from "../src/server/seed-database.ts";

export { seedDatabase };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase();
}
