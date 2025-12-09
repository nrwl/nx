import { join } from 'path';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { CollectionEntry } from 'astro:content';
import { watchAndCall } from './utils/watch';
import { loadCnwPackage } from './utils/cnw-generation';
import { loadNxCliPackage } from './utils/nx-cli-generation';
import { loadNxSpecialPackage } from './utils/core-nx-plugin-generation';
import { loadDevkitPackage } from './utils/devkit-generation';

export function NxReferencePackagesLoader(): Loader {
  return {
    name: 'nx-reference-packages-loader',
    async load(context: LoaderContext) {
      const { logger, watcher, store } = context;

      const generate = async () => {
        logger.info(
          'Starting Nx reference packages documentation generation...'
        );
        store.clear();

        // Load all packages in parallel
        const results = await Promise.allSettled([
          // remap these functions to arrays so it's easier to process all functions in bulk
          // I should probs make this nicer down the road but that's future calebs problem
          loadCnwPackage(context).then((r) => [r]),
          loadNxCliPackage(context).then((r) => [r]),
          loadDevkitPackage(context),
          loadNxSpecialPackage('nx', context),
          loadNxSpecialPackage('plugin', context),
          loadNxSpecialPackage('web', context),
          loadNxSpecialPackage('workspace', context),
        ]);

        // Process results and store documents
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const doc of result.value) {
              store.set(doc);
            }
          } else {
            logger.error(`Failed to load package: ${result.reason}`);
          }
        }

        logger.info(
          '✅ Nx reference packages documentation generation complete'
        );
      };

      // Set up file watching
      if (watcher) {
        const pathsToWatch = [
          join(import.meta.dirname, 'nx-reference-packages.loader.ts'),
          join(import.meta.dirname, 'utils', 'cnw-subprocess.cjs'),
          join(import.meta.dirname, 'utils', 'cli-subprocess.cjs'),
          join(import.meta.dirname, 'utils', 'typedoc'),
          join(import.meta.dirname, 'utils', 'plugin-schema-parser.ts'),
          join(import.meta.dirname, 'utils', 'generate-plugin-markdown.ts'),
        ];

        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
