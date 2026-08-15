let deterministicCounter = 0;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  deterministicCounter += 1;
  return `${prefix}-${Date.now()}-${deterministicCounter}`;
}
