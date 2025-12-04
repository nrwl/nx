import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForNuxt(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-nuxt-4.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions);
  tree.write('ai-migrations/MIGRATE_NUXT_4.md', contents);
  return [
    `We created 'ai-migrations/MIGRATE_NUXT_4.md' with instructions for an AI Agent to help migrate your Nuxt projects to Nuxt 4.`,
  ];
}
