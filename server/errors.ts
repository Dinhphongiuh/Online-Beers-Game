/** Thrown when MongoDB or Redis is not configured or not reachable. Maps to HTTP 503. */
export class BackendUnavailableError extends Error {
  readonly status = 503;

  constructor(
    readonly service: 'MongoDB' | 'Redis',
    reason: string
  ) {
    super(`${service} unavailable: ${reason}`);
    this.name = 'BackendUnavailableError';
  }
}

/** Mongoose / Mongo driver errors that mean "database unreachable", not "bad request". */
export function isDatabaseConnectionError(err: unknown): boolean {
  if (err instanceof BackendUnavailableError) return true;
  const e = err as { name?: string; message?: string } | null;
  if (!e) return false;
  return (
    e.name === 'MongoNetworkError' ||
    e.name === 'MongoServerSelectionError' ||
    e.name === 'MongoNotConnectedError' ||
    (e.name === 'MongooseError' && /buffer|connect/i.test(e.message || '')) ||
    /Connection is closed|Stream isn't writeable|enableOfflineQueue/i.test(e.message || '')
  );
}
