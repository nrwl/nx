/**
 * Puts spawned expo processes into headless mode, and returns a callback that
 * restores the previous value.
 *
 * Jest sets NODE_ENV=test, which spawned expo processes inherit. @expo/cli then
 * leaves the standalone fusebox shell experiment on, and dev-middleware 0.85+
 * eagerly prepares the debugger shell, which throws "DefaultToolLauncher must be
 * mocked or overridden in tests". EXPO_UNSTABLE_HEADLESS is @expo/cli's only
 * switch for that experiment.
 */
export function setupExpoEnv(): () => void {
  const original = process.env.EXPO_UNSTABLE_HEADLESS;
  process.env.EXPO_UNSTABLE_HEADLESS = '1';

  return () => {
    if (original === undefined) {
      delete process.env.EXPO_UNSTABLE_HEADLESS;
    } else {
      process.env.EXPO_UNSTABLE_HEADLESS = original;
    }
  };
}
