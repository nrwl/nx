import { access, constants } from 'fs/promises';
import which from 'which';
import { logger } from '../../../utils/logger';
import { AgentDefinition, DetectedInstalledAgent } from './types';

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch (err) {
    // EACCES on an existing path means "this looks installed but we can't
    // execute it" — surface so the user can answer "why isn't my agent
    // detected?" without grep-debugging the filesystem.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code && code !== 'ENOENT') {
      logger.verbose(`Agent detection: cannot probe ${path} (${code}).`);
    }
    return false;
  }
}

async function findOnPath(
  binaryNames: readonly string[]
): Promise<string | null> {
  for (const name of binaryNames) {
    // `which@3` only throws on missing binary (`ENOENT`-equivalent); its
    // underlying `isexe` swallows EACCES via `ignoreErrors: true`, so a
    // try/catch around `which(name)` would catch nothing useful. Use the
    // `{ nothrow: true }` variant for a null-on-miss contract without the
    // throw-per-missing-binary cost.
    const found = await which(name, { nothrow: true });
    if (typeof found === 'string') {
      return found;
    }
  }
  return null;
}

async function findInWellKnownPaths(
  paths: readonly string[]
): Promise<string | null> {
  for (const candidate of paths) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function detectOne(
  definition: AgentDefinition
): Promise<DetectedInstalledAgent | null> {
  const onPath = await findOnPath(definition.binaryNames);
  if (onPath) {
    return {
      id: definition.id,
      displayName: definition.displayName,
      binary: onPath,
      source: 'path',
    };
  }

  const inWellKnown = await findInWellKnownPaths(definition.wellKnownPaths());
  if (inWellKnown) {
    return {
      id: definition.id,
      displayName: definition.displayName,
      binary: inWellKnown,
      source: 'well-known',
    };
  }

  return null;
}

/**
 * Probes each given agent definition for an installed binary on the user's
 * machine. PATH is checked first via `which` (which handles Windows PATHEXT),
 * then the per-agent well-known fallback paths. Probes run in parallel.
 *
 * Returns only the agents that were found, preserving the order of the input
 * `definitions` argument for callers that rely on it for picker presentation.
 */
export async function detectInstalledAgents(
  definitions: readonly AgentDefinition[]
): Promise<DetectedInstalledAgent[]> {
  const results = await Promise.all(definitions.map(detectOne));
  return results.filter(
    (result): result is DetectedInstalledAgent => result !== null
  );
}
