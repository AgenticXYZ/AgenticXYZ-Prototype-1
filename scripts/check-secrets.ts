import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".playwright-cli", "dist", "node_modules", "playwright-report", "test-results", "output"]);
const ignoredFiles = new Set(["package-lock.json"]);
const patterns = [
  { label: "API key", expression: /\bsk-(?!example|test)[A-Za-z0-9_-]{16,}\b/g },
  { label: "Private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "Authorization bearer", expression: /\bBearer\s+(?!abcdefghijklmnopqrstuvwxyz)[A-Za-z0-9._-]{20,}\b/gi },
  { label: "Personal absolute path", expression: /\/(?:Users|home)\/(?!person\/)[A-Za-z0-9._-]+\//g }
];

function trackedByGit(file: string): boolean {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", path.relative(root, file)], {
      cwd: root,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(absolute);
    const localEnvironmentFile = entry.name === ".env" || entry.name === ".env.local" || (/^\.env\..*\.local$/).test(entry.name);
    if (!entry.isFile() || ignoredFiles.has(entry.name) || (localEnvironmentFile && !trackedByGit(absolute))) return [];
    return [absolute];
  });
}

const findings: string[] = [];
for (const file of files(root)) {
  const contents = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.expression.test(contents)) findings.push(`${path.relative(root, file)}: ${pattern.label}`);
    pattern.expression.lastIndex = 0;
  }
}
if (findings.length > 0) throw new Error(`Secret scan failed:\n${findings.join("\n")}`);
process.stdout.write("Secret and personal-path scan passed.\n");
