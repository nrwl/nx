export function withEnvironmentVariables<T>(
  env: Record<string, string | false | null | undefined>,
  callback: () => T
): T {
  const originalValues: Record<string, string> = {};
  for (const key in env) {
    originalValues[key] = process.env[key];
    const value = env[key];
    if (value) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
  const cleanup = () => {
    for (const key in env) {
      process.env[key] = originalValues[key];
    }
  };
  const p = callback();
  if (p instanceof Promise) {
    return p.finally(cleanup) as T;
  } else {
    cleanup();
    return p;
  }
}
