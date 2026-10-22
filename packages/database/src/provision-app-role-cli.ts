import { provisionApplicationRole } from "./provision-app-role.js";

const url = process.env.DATABASE_URL;
const password = process.env.EVOTE_APP_PASSWORD;
if (!url || !password) {
  console.error("DATABASE_URL (owner connection) and EVOTE_APP_PASSWORD are required");
  process.exit(1);
}

try {
  await provisionApplicationRole(url, password);
  process.stdout.write("Application role evote_app can now log in.\n");
} catch (err) {
  console.error("Provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
