import { parseTokens } from '../../../tasks-runner/tokens';
import { interpolate } from '../../../tasks-runner/utils';

// A call site passes only the values it has, so a fallback is found by name
const releaseTokens = new Set([
  'version',
  'projectName',
  'releaseGroupName',
  'projectRoot',
  'workspaceRoot',
]);

// Every run resolves the configuration again, for example the tag pattern to
// find the previous release, so it can't depend on the environment
export function interpolateReleaseConfig(
  template: string,
  data: Record<string, unknown>
): string {
  rejectFallbacks(template);
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

// Tags, commit messages and the previous-tag lookup fill in different values,
// so a fallback wouldn't resolve the same way in each
function rejectFallbacks(template: string): void {
  const nodes = parseTokens(template, {
    isToken: (name) => name === 'env' || releaseTokens.has(name),
    read: () => undefined,
    noValue: (token) => token,
  });
  if (nodes.some((node) => node.kind === 'token' && node.parts.length > 1)) {
    throw new Error(
      `Release configuration '${template}' is invalid. It can't use ?? fallbacks.`
    );
  }
}
