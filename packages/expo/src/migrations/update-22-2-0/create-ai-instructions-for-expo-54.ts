import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Tree } from '@nx/devkit';

export default async function createAiInstructionsForExpo54(tree: Tree) {
  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-expo-54.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions, 'utf-8');
  tree.write('tools/ai-migrations/MIGRATE_EXPO_54.md', contents);
  return [
    `We created 'tools/ai-migrations/MIGRATE_EXPO_54.md' with instructions for an AI Agent to help migrate your Expo projects to Expo SDK 54.`,
  ];
}
