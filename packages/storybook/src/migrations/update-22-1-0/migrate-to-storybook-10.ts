import { Tree } from '@nx/devkit';
import { output } from 'nx/src/utils/output';
import migrate10Generator from '../../generators/migrate-10/migrate-10';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export default async function migrateToStorybook10(tree: Tree) {
  output.log({
    title: 'Migrating Storybook to v10',
    bodyLines: [
      `🚀 This migration will update your Storybook configuration to v10.`,
      `It will call the @nx/storybook:migrate-10 generator for you.`,
      `You can read more about the migration and how this generator works here:`,
      `https://nx.dev/nx-api/storybook/generators/migrate-10`,
    ],
  });
  await migrate10Generator(tree, {
    autoAcceptAllPrompts: true,
  });

  return [
    `Storybook 10 requires Storybook Configs to use ESM.`,
    `We created 'tools/ai-migrations/MIGRATE_STORYBOOK_10.md' with instructions for an AI Agent to convert CJS Storybook Configs to ESM in your workspace.`,
  ];
}
