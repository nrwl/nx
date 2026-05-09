import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForVite8(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-vite-8.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions);
  tree.write('tools/ai-migrations/MIGRATE_VITE_8.md', contents);
  return [
    `We created 'tools/ai-migrations/MIGRATE_VITE_8.md' with instructions for an AI Agent to help migrate your Vite projects to Vite 8.`,
  ];
}
