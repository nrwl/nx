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

// A config compiled to CJS require()s the ESM-only packages it imports, and
// configs load in parallel during graph creation - so that require() can land
// while another load's import() of the same package is still linking. The
// import settles within a few turns, so the same load strategy is retried
// rather than switched to import(), which would change the config's scope.
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
