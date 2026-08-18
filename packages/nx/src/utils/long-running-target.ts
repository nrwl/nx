/**
 * Target names the pre-23 `longRunningTask` guard excluded from caching. Shared
 * between that guard and the deprecated target-name cache fallback so the two
 * cannot drift apart.
 *
 * The copy in `migrations/update-23-2-0/set-cache-on-executor-target-defaults.ts`
 * deliberately does not use this: a migration's decision has to freeze at the
 * semantics it shipped with.
 */
export function isLongRunningTargetName(targetName: string): boolean {
  return (
    targetName.endsWith(':watch') ||
    targetName.endsWith('-watch') ||
    targetName === 'serve' ||
    targetName === 'dev' ||
    targetName === 'start'
  );
}
