import fs from "fs";
import path from "path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  bundle: true,
  splitting: false,
  external: [
    "express",
    "@prisma/client",
    "cors",
    "cookie-parser",
    "compression",
    "dotenv",
    "helmet",
    "hpp",
    "morgan",
    "events",
    "path",
    "fs",
    "url"
  ],

  async onSuccess() {
    const srcDir = path.join(__dirname, "src/templates");
    const destDir = path.join(__dirname, "dist/templates");
    if (fs.existsSync(srcDir)) {
      fs.cpSync(srcDir, destDir, { recursive: true });
      console.log("✅ Templates successfully copied to dist/templates");
    } else {
      console.warn("⚠️ Warning: src/templates folder not found!");
    }
  },
});