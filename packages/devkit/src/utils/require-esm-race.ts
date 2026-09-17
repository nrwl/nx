import { pathToFileURL } from 'node:url';

const dynamicImport = (modulePath: string) => import(modulePath);

const REQUIRE_ESM_RACE_MESSAGE =
  /Cannot require\(\) ES Module (.+) because it is not yet fully loaded\.(?:\r?\n|$)/;

const MAX_RETRIES = 20;
const CONFIG_EXTENSION_HINT =
  'Rename your Vite or Vitest config file to use the .mts or .mjs extension to avoid this error.';

// Node rejects require() of an ES module while an import() of it is still
// linking. Newer Node versions expose ERR_REQUIRE_ESM_RACE_CONDITION
// (https://github.com/nodejs/node/pull/62462). Older versions report an
// ERR_INTERNAL_ASSERTION, so its known message is the only way to distinguish
// this race from unrelated internal assertions. Matching that legacy format is
// safe for the releases that emitted it.
export function isRequireEsmRaceError(e: unknown): boolean {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  return (
    code === 'ERR_REQUIRE_ESM_RACE_CONDITION' ||
    (code === 'ERR_INTERNAL_ASSERTION' &&
      /not yet fully loaded/.test(message ?? ''))
  );
}

function getRacedModulePath(e: unknown): string | undefined {
  if (!isRequireEsmRaceError(e)) {
    return;
  }
  const { message } = e as { message?: string };
  return message?.match(REQUIRE_ESM_RACE_MESSAGE)?.[1];
}

export async function retryOnRequireEsmRace<T>(
  load: () => Promise<T>,
  importModule = dynamicImport
): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await load();
    } catch (e) {
      if (!isRequireEsmRaceError(e) || retries >= MAX_RETRIES) {
        throw e;
      }

      const racedModulePath = getRacedModulePath(e);
      if (!racedModulePath) {
        const error = e as Error;
        error.message += `\n\n${CONFIG_EXTENSION_HINT}`;
        throw error;
      }
      retries++;

      // This joins the cached module job instead of guessing when it settles.
      await importModule(pathToFileURL(racedModulePath).href);
    }
  }
}
