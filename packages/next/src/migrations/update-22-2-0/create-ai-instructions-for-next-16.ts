import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForNext16(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-next-16.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions, 'utf-8');
  tree.write('ai-migrations/MIGRATE_NEXT_16.md', contents);
  return [
    `We created 'ai-migrations/MIGRATE_NEXT_16.md' with instructions for an AI Agent to help migrate your Next.js projects to Next.js 16.`,
  ];
}
