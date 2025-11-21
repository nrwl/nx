import { formatFiles, readJson, Tree } from '@nx/devkit';

import { output } from 'nx/src/utils/output';
import { callUpgrade, checkStorybookInstalled } from './calling-storybook-cli';
import { Schema } from './schema';

export async function migrate10Generator(tree: Tree, schema: Schema) {
  const packageJson = readJson(tree, 'package.json');
  if (!checkStorybookInstalled(packageJson)) {
    output.error({
      title: 'No Storybook packages installed',
      bodyLines: [
        `🚨 Nx did not find any Storybook packages installed in your workspace.`,
        `So no migration is necessary.`,
      ],
    });
    return;
  }

  callUpgrade(schema);

  await formatFiles(tree);
}

export default migrate10Generator;
