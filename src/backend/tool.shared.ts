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
