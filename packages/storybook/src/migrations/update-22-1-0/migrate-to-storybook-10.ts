import { Tree, output } from '@nx/devkit';
import migrate10Generator from '../../generators/migrate-10/migrate-10';

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
    skipAiInstructions: true,
  });
}
