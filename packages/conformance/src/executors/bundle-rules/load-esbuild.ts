import type * as esbuild from 'esbuild';

// esbuild is an optional peer of @nx/conformance, so only this executor requires it
export async function loadEsbuild(
  importEsbuild: () => Promise<typeof esbuild> = () => import('esbuild')
): Promise<typeof esbuild> {
  try {
    return await importEsbuild();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (
      (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') &&
      (e as Error).message.includes(`'esbuild'`)
    ) {
      throw new Error(
        'The @nx/conformance:bundle-rules executor requires esbuild. Install it in your workspace, e.g. `npm install -D esbuild`.',
        { cause: e }
      );
    }
    throw e;
  }
}
