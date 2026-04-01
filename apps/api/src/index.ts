import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const port = Number(process.env.PORT ?? 3001);

const { app } = await import("./app.js");

app.listen(port, () => {
  console.log(`RedPulse API listening on http://localhost:${port}`);
});
