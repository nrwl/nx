import { Tree } from '@nx/devkit';
import { output } from 'nx/src/utils/output';
import migrate9Generator from '../../generators/migrate-9/migrate-9';
import { storybookMajorVersion } from '../../utils/utilities';

export default async function changeStorybookTargets(tree: Tree) {
  const storybookVersion = storybookMajorVersion();
  if (!storybookVersion) {
    /**
     * This just checks if Storybook is installed in the workspace.
     * The thing here is that during the previous step of the migration,
     * during packageJsonUpdates, Nx has already set Storybook
     * to version 9, if Storybook exists in the workspace.
     * So, it makes no sense here to check if the version is
     * 8, because it will always be.
     */
    return;
  }

  output.log({
    title: 'Migrating Storybook to v9',
    bodyLines: [
      `🚀 This migration will update your Storybook configuration to v9.`,
      `It will call the @nx/storybook:migrate-9 generator for you.`,
      `You can read more about the migration and how this generator works here:`,
      `https://nx.dev/nx-api/storybook/generators/migrate-9`,
    ],
  });
  return migrate9Generator(tree, {
    autoAcceptAllPrompts: true,
    versionTag: 'latest',
  });
}
