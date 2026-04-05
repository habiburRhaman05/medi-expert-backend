import { defineConfig } from "tsup";
import { execSync } from "child_process";
import path from "path";
import  fs from "fs";

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
  // 🔑 Build shesh hole templates folder-ti dist-e copy korbe
  async onSuccess() {
    const srcDir = path.join(__dirname, "src/templates");
    const destDir = path.join(__dirname, "dist/templates");

    if (fs.existsSync(srcDir)) {
      // Node.js 16.7+ version-e recursive copy support kore
      fs.cpSync(srcDir, destDir, { recursive: true });
      console.log("✅ Templates successfully copied to dist/templates");
    } else {
      console.warn("⚠️ Warning: src/templates folder not found!");
    }
  },
});