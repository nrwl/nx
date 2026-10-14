import { interpolate } from '../../../tasks-runner/utils';

// Every run resolves the configuration again, for example the tag pattern to
// find the previous release, so it can't depend on the environment
export function interpolateReleaseConfig(
  template: string,
  data: Record<string, unknown>
): string {
  return interpolate(template, data, {
    envNotAllowed: (template) =>
      `Release configuration '${template}' is invalid. It can't read environment variables, because every release run must resolve it the same way.`,
  });
}

/**
 * Throws what `interpolateReleaseConfig` throws for `template` when it gets
 * values for `tokens`, so a release can fail before it writes anything
 */
export function validateReleaseConfigTemplate(
  template: string,
  tokens: readonly string[]
): void {
  interpolateReleaseConfig(
    template,
    Object.fromEntries(tokens.map((token) => [token, '']))
  );
}
