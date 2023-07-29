import { Tree } from '@nx/devkit';
import { output } from 'nx/src/utils/output';
import migrate7Generator from '../../generators/migrate-7/migrate-7';
import { storybookMajorVersion } from '../../utils/utilities';

export default async function changeStorybookTargets(tree: Tree) {
  const storybookVersion = storybookMajorVersion();
  if (!storybookVersion) {
    /**
     * This just checks if Storybook is installed in the workspace.
     * The thing here is that during the previous step of the migration,
     * during packageJsonUpdates, Nx has already set Storybook
     * to version 7, if Storybook exists in the workspace.
     * So, it makes no sense here to check if the version is
     * 7, because it will always be.
     */
    return;
  }

  output.log({
    title: 'Migrating Storybook to v7',
    bodyLines: [
      `🚀 This migration will update your Storybook configuration to v7.`,
      `It will call the @nx/storybook:migrate-7 generator for you.`,
      `You can read more about the migration and how this generator works here:`,
      `https://nx.dev/packages/storybook/generators/migrate-7`,
    ],
  });
  return migrate7Generator(tree, { autoAcceptAllPrompts: true });
}
