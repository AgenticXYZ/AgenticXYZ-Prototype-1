import fs from "node:fs";
import path from "node:path";

import { checksum } from "../src/core/hash";
import { scanText } from "../src/core/privacy";

const directory = path.resolve(process.cwd(), "recorded-runs/canonical");
const checksumPath = path.join(directory, "checksums.json");
if (!fs.existsSync(checksumPath)) throw new Error("Canonical replay checksums are missing. Run npm run freeze:replay.");
const manifest = JSON.parse(fs.readFileSync(checksumPath, "utf8")) as { artifacts: Record<string, string> };
for (const [name, expected] of Object.entries(manifest.artifacts)) {
  const contents = fs.readFileSync(path.join(directory, name), "utf8");
  const actual = checksum(contents);
  if (actual !== expected) throw new Error(`${name} checksum mismatch: expected ${expected}, received ${actual}.`);
  const privacy = scanText(contents);
  if (privacy.status !== "pass") throw new Error(`${name} contains ${privacy.findings.length} privacy or secret finding(s).`);
}
process.stdout.write(`Canonical reference replay verified: ${Object.keys(manifest.artifacts).length} artifacts.\n`);
