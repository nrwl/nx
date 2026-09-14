const MAX_ATTEMPTS = 5;

// Node rejects require() of an ES module while an import() of it is still
// linking: ERR_REQUIRE_ESM_RACE_CONDITION on Node 26+, ERR_INTERNAL_ASSERTION
// with this message on Node 22/24.
export function isRequireEsmRaceError(e: unknown): boolean {
  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  return (
    code === 'ERR_REQUIRE_ESM_RACE_CONDITION' ||
    (code === 'ERR_INTERNAL_ASSERTION' &&
      /not yet fully loaded/.test(message ?? ''))
  );
}

// Vite bundles a vite.config.ts in a CJS package to CJS and require()s it, so an
// ESM-only plugin it imports gets require()d. Configs load in parallel during
// graph creation, so that require() can land while another config's import() of
// the same plugin is still linking. The import settles within a few turns.
export async function retryOnRequireEsmRace<T>(
  load: () => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await load();
    } catch (e) {
      if (attempt === MAX_ATTEMPTS || !isRequireEsmRaceError(e)) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
}
