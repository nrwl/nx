import { formatFiles, logger, readJson, Tree } from '@nx/devkit';

import { output } from 'nx/src/utils/output';
import { callUpgrade, checkStorybookInstalled } from './calling-storybook-cli';
import { Schema } from './schema';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

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

  const pathToAiInstructions = join(
    __dirname,
    'files',
    'ai-instructions-for-cjs-esm.md'
  );
  if (!existsSync(pathToAiInstructions)) {
    return;
  }

  const contents = readFileSync(pathToAiInstructions);
  tree.write('tools/ai-migrations/MIGRATE_STORYBOOK_10.md', contents);

  logger.log(`Storybook 10 requires Storybook Configs to use ESM.
We created 'tools/ai-migrations/MIGRATE_STORYBOOK_10.md' with instructions for an AI Agent to convert CJS Storybook Configs to ESM in your workspace.`);

  await formatFiles(tree);
}

export default migrate10Generator;
