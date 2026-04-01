import { loadEnvironment } from "./lib/env.js";

loadEnvironment();
const port = Number(process.env.PORT ?? 3001);

const { app } = await import("./app.js");

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`RedPulse API listening on http://localhost:${port}`);
  });
}
