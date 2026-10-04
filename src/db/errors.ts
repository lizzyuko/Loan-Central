/** Postgres unique-violation detection that works through Drizzle's error wrapping. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i++) {
    const e = current as { code?: string; constraint_name?: string; constraint?: string; cause?: unknown };
    if (e.code === "23505") {
      return !constraint || e.constraint_name === constraint || e.constraint === constraint;
    }
    current = e.cause;
  }
  return false;
}
