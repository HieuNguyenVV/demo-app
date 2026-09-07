export class InvalidToolInputError extends Error {
  readonly status = 400 as const;
  readonly code = 'INVALID_INPUT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidToolInputError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asJsonArray(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseJsonArrayString(value);
    if (parsed) return parsed;
  }
  throw new InvalidToolInputError(`${field} must be an array`);
}

function parseJsonArrayString(raw: string): unknown[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return undefined;
  for (const candidate of [trimmed, quoteBareJsonIdentifiers(trimmed)]) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return undefined;
}

function quoteBareJsonIdentifiers(source: string): string {
  return source.replace(/:\s*([A-Za-z_][A-Za-z0-9_-]*)\s*(?=,|}|])/g, (full, id: string) => {
    if (id === 'true' || id === 'false' || id === 'null') return full;
    return `:"${id}"`;
  });
}
