import { logger } from '@nx/devkit';

// npm and bun refuse to publish to a registry without a token for it
export const PLACEHOLDER_AUTH_TOKEN = 'secretVerdaccioToken';

/**
 * Verdaccio 7+ answers 401 to a token it cannot decode, unless its config
 * enables JWT tokens, which treat such a token as anonymous. Resolves `false`
 * when the registry cannot be reached, so callers keep the token.
 */
export async function isPlaceholderAuthTokenRejected(
  registryUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(new URL('-/ping', registryUrl), {
      headers: { authorization: `Bearer ${PLACEHOLDER_AUTH_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    return response.status === 401;
  } catch {
    return false;
  }
}

export function warnPlaceholderAuthTokenRejected(registryUrl: string): void {
  logger.warn(
    `Verdaccio at ${registryUrl} rejects the placeholder npm auth token. Without a token, npm and bun cannot publish to the registry.
If the registry requires a login, publish with a token from \`npm login\`.
Otherwise, make Verdaccio accept the placeholder by adding the following to its config file. Existing tokens from \`npm login\` then stop working until users log in again.

security:
  api:
    jwt:
      sign:
        expiresIn: 7d`
  );
}
