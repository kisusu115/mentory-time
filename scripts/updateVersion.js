import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, "../manifest.json");
const packagePath = resolve(__dirname, "../package.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const parts = manifest.version.split(".").map(Number);

// patch 버전 +1
parts[2] = (parts[2] || 0) + 1;
manifest.version = parts.join(".");

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

// package.json 버전 동기화
const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
pkg.version = manifest.version;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

console.log(`Version updated to ${manifest.version}`);
