import type { KPR, PrivacyScan } from "./types";
import { nowIso } from "./time";

const SECRET_PATTERNS = [
  { kind: "anthropic_api_key", pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "openai_or_compatible_api_key", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { kind: "authorization_header", pattern: /\bAuthorization\s*:\s*[^\r\n]+/gi },
  { kind: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/gi },
  { kind: "cookie_header", pattern: /\b(?:Cookie|Set-Cookie)\s*:\s*[^\r\n]+/gi },
  { kind: "environment_secret", pattern: /\b[A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^\s]{8,}/g },
  { kind: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { kind: "phone_number", pattern: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]\d{3}[ .-]\d{4}\b/g },
  { kind: "absolute_user_path", pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g }
];

export function redactText(input: string): string {
  return SECRET_PATTERNS.reduce(
    (value, item) => value.replace(item.pattern, `[REDACTED:${item.kind}]`),
    input
  );
}

export function scanText(input: string): PrivacyScan {
  const findings: PrivacyScan["findings"] = [];
  for (const item of SECRET_PATTERNS) {
    const matches = input.matchAll(new RegExp(item.pattern.source, item.pattern.flags));
    for (const match of matches) {
      findings.push({
        kind: item.kind,
        location: `character ${match.index ?? 0}`,
        preview: redactText(match[0]).slice(0, 80)
      });
    }
  }
  return {
    status: findings.length === 0 ? "pass" : "blocked",
    findings,
    scannedAt: nowIso()
  };
}

export function scanKpr(kpr: KPR): PrivacyScan {
  const safeClone = {
    ...kpr,
    privacyAndLicense: {
      ...kpr.privacyAndLicense,
      privacyScan: { status: "not_run", findings: [] }
    }
  };
  return scanText(JSON.stringify(safeClone));
}
