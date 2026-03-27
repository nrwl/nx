import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForTailwindV4(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-tailwind-v4.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions, 'utf-8');
  tree.write('tools/ai-migrations/MIGRATE_TAILWIND_V4.md', contents);
  return [
    `We created 'tools/ai-migrations/MIGRATE_TAILWIND_V4.md' with instructions for an AI Agent to help remove @nx/next/tailwind usage and migrate to Tailwind CSS v4 @source directives.`,
  ];
}
