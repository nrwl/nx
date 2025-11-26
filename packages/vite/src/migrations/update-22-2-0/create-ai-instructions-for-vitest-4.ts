import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForVitest(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-vitest-4.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions);
  tree.write('ai-migrations/MIGRATE_VITEST_4.md', contents);
  return [
    `We created 'ai-migrations/MIGRATE_VITEST_4.md' with instructions for an AI Agent to help migrate your Vitest projects to Vitest 4.`,
  ];
}
