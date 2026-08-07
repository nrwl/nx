import { formatFiles, logger, readJson, Tree, output } from '@nx/devkit';

import { callUpgrade, checkStorybookInstalled } from './calling-storybook-cli';
import { Schema } from './schema';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { assertSupportedStorybookVersion } from '../../utils/assert-supported-storybook-version';

export async function migrate10Generator(tree: Tree, schema: Schema) {
  assertSupportedStorybookVersion(tree);

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

  if (schema.skipAiInstructions) {
    return;
  }

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
