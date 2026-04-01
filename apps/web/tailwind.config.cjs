const sharedConfig = require("../../tailwind.config.js");

module.exports = {
  ...sharedConfig,
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"]
};
