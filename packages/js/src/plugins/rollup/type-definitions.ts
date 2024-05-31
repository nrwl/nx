// nx-ignore-next-line
import type { OutputBundle } from 'rollup'; // only used  for types
import { relative } from 'path';
import { stripIndents } from '@nx/devkit';

//NOTE: This is here so we can share between `@nx/rollup` and `@nx/vite`.

/*
 * This plugin takes all entry-points from the generated bundle and creates a
 * bundled version of corresponding d.ts files.
 *
 * For example, `src/index.ts` generates two corresponding files:
 * - `dist/xyz/index.js`
 * - `dist/xyz/src/index.d.ts`
 *
 * We want a third file: `dist/index.d.ts` that re-exports from `src/index.d.ts`.
 * That way, when TSC or IDEs look for types, it will find them in the right place.
 */
export function typeDefinitions(options: { projectRoot: string }) {
  return {
    name: 'dts-bundle',
    async generateBundle(_opts: unknown, bundle: OutputBundle): Promise<void> {
      for (const [name, file] of Object.entries(bundle)) {
        if (
          file.type === 'asset' ||
          !file.isEntry ||
          file.facadeModuleId == null
        ) {
          continue;
        }

        const hasDefaultExport = file.exports.includes('default');
        const entrySourceFileName = relative(
          options.projectRoot,
          file.facadeModuleId
        );
        const entrySourceDtsName = entrySourceFileName.replace(
          /\.[cm]?[jt]sx?$/,
          ''
        );
        const dtsFileName = file.fileName.replace(/\.[cm]?js$/, '.d.ts');
        const relativeSourceDtsName = JSON.stringify('./' + entrySourceDtsName);
        const dtsFileSource = hasDefaultExport
          ? stripIndents`
              export * from ${relativeSourceDtsName};
              export { default } from ${relativeSourceDtsName};
            `
          : `export * from ${relativeSourceDtsName};\n`;

        this.emitFile({
          type: 'asset',
          fileName: dtsFileName,
          source: dtsFileSource,
        });
      }
    },
  };
}
