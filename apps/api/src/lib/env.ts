import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

let loaded = false;

export function loadEnvironment() {
  if (loaded) {
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
  dotenv.config();

  loaded = true;
}
