import type { TargetDependencyConfig } from 'nx/src/devkit-exports';

/**
 * `dependsOn` with `inputs: false` on the entries that name projects: the
 * servers a test talks to, not its readiness gate.
 */
export function withoutServerInputs(
  dependsOn: (string | TargetDependencyConfig)[]
): (string | TargetDependencyConfig)[] {
  return dependsOn.map((dependency) =>
    typeof dependency !== 'string' && dependency.projects
      ? { ...dependency, inputs: false }
      : dependency
  );
}
