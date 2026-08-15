import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig, loadEnvironmentFiles } from "../../server/config";

const ENVIRONMENT_KEYS = [
  "AGENTICXYZ_PROVIDER",
  "AGENTICXYZ_MODEL",
  "AGENTICXYZ_REQUEST_TIMEOUT_MS",
  "DEEPSEEK_REASONING_EFFORT",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY"
] as const;

const original = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENVIRONMENT_KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("local Provider configuration", () => {
  it("loads .env.local before .env without overriding an existing process value", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agenticxyz-config-"));
    fs.writeFileSync(path.join(directory, ".env.local"), "AGENTICXYZ_PROVIDER=deepseek\nAGENTICXYZ_MODEL=local-model\nDEEPSEEK_API_KEY=local-test-key\nDEEPSEEK_REASONING_EFFORT=max\nAGENTICXYZ_REQUEST_TIMEOUT_MS=0\n");
    fs.writeFileSync(path.join(directory, ".env"), "AGENTICXYZ_MODEL=fallback-model\n");
    process.env.AGENTICXYZ_MODEL = "process-model";
    delete process.env.AGENTICXYZ_PROVIDER;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_REASONING_EFFORT;
    delete process.env.AGENTICXYZ_REQUEST_TIMEOUT_MS;

    loadEnvironmentFiles(directory);
    const config = loadConfig();

    expect(config.activeProvider).toBe("deepseek");
    expect(config.activeModel).toBe("process-model");
    expect(config.providers.deepseek.apiKey).toBe("local-test-key");
    expect(config.providers.deepseek.reasoningEffort).toBe("max");
    expect(config.requestTimeoutMs).toBe(0);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("defaults invalid DeepSeek reasoning effort to high", () => {
    process.env.DEEPSEEK_REASONING_EFFORT = "medium";
    expect(loadConfig().providers.deepseek.reasoningEffort).toBe("high");
  });
});
