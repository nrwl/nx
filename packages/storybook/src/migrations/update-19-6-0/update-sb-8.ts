import { Tree } from '@nx/devkit';
import { output } from 'nx/src/utils/output';
import migrate8Generator from '../../generators/migrate-8/migrate-8';
import { storybookMajorVersion } from '../../utils/utilities';

export default async function changeStorybookTargets(tree: Tree) {
  const storybookVersion = storybookMajorVersion();
  if (!storybookVersion) {
    /**
     * This just checks if Storybook is installed in the workspace.
     * The thing here is that during the previous step of the migration,
     * during packageJsonUpdates, Nx has already set Storybook
     * to version 8, if Storybook exists in the workspace.
     * So, it makes no sense here to check if the version is
     * 7, because it will always be.
     */
    return;
  }

  output.log({
    title: 'Migrating Storybook to v8',
    bodyLines: [
      `🚀 This migration will update your Storybook configuration to v8.`,
      `It will call the @nx/storybook:migrate-8 generator for you.`,
      `You can read more about the migration and how this generator works here:`,
      `https://nx.dev/nx-api/storybook/generators/migrate-8`,
    ],
  });
  return migrate8Generator(tree, { autoAcceptAllPrompts: true });
}
