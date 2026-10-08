import { readProjectConfiguration, type Tree } from '@nx/devkit';
import {
  migrateRemovedExecutors,
  NoTargetsToMigrateError,
} from '@nx/devkit/internal';

const viteExecutors = [
  '@nx/vite:build',
  '@nx/vite:dev-server',
  '@nx/vite:preview-server',
  '@nrwl/vite:build',
  '@nrwl/vite:dev-server',
  '@nrwl/vite:preview-server',
];
// Earlier @nx/vite migrations rewrite test targets to @nx/vitest:test, but on
// pnpm @nx/vitest is only transitive, so its own migration may never run.
const vitestExecutors = ['@nx/vitest:test', '@nx/vite:test', '@nrwl/vite:test'];

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [...viteExecutors, ...vitestExecutors],
    async (tree, options) => {
      const executors = Object.values(
        readProjectConfiguration(tree, options.project).targets ?? {}
      ).map((target) => target.executor);

      if (executors.some((executor) => viteExecutors.includes(executor))) {
        const { convertToInferred } =
          require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
        // The callback only prints the options the converter could not carry
        // over; migrateRemovedExecutors discards it.
        await skipUnmigrated(async () => {
          const flushLogs = await convertToInferred(tree, options);
          flushLogs();
        });
      }
      if (executors.includes('@nx/vitest:test')) {
        const { convertVitestToInferred } =
          require('@nx/vitest/internal') as typeof import('@nx/vitest/internal');
        await skipUnmigrated(() => convertVitestToInferred(tree, options));
      }
    }
  );
}

// A converter that skips the project must not stop the other one; the
// leftover re-scan in migrateRemovedExecutors still names what it left.
async function skipUnmigrated(convert: () => Promise<unknown>) {
  try {
    await convert();
  } catch (error) {
    if (!(error instanceof NoTargetsToMigrateError)) {
      throw error;
    }
  }
}
