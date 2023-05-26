export function withEnvironmentVariables(
  env: Record<string, string>,
  callback: () => void
): void;
export function withEnvironmentVariables(
  env: Record<string, string>,
  callback: () => Promise<void>
): Promise<void>;
export function withEnvironmentVariables(
  env: Record<string, string>,
  callback: () => void | Promise<void>
): void | Promise<void> {
  const originalValues: Record<string, string> = {};
  for (const key in env) {
    originalValues[key] = process.env[key];
    process.env[key] = env[key];
  }
  const cleanup = () => {
    for (const key in env) {
      process.env[key] = originalValues[key];
    }
  };
  const p = callback();
  if (p instanceof Promise) {
    return p.finally(cleanup);
  } else {
    cleanup();
  }
}
