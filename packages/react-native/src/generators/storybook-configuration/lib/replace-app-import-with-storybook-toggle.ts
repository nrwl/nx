import {
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { join } from 'path';

import { StorybookConfigureSchema } from '../schema';

/**
 * To replace the import statement for storybook.
 * Need to import app with storybook toggle from .storybook/toggle-storybook
 */
export function replaceAppImportWithStorybookToggle(
  host: Tree,
  schema: StorybookConfigureSchema
) {
  const { root, sourceRoot } = readProjectConfiguration(host, schema.name);

  const mainFilePath = join(sourceRoot, schema.js ? 'main.js' : 'main.tsx');
  const appImportImport = `import App from './app/App';`;
  const storybookeToggleImport = `import App from '../.storybook/toggle-storybook';`;

  try {
    logger.debug(`Updating import for ${mainFilePath}`);
    const contents = host.read(mainFilePath, 'utf-8');
    if (
      !contents.includes(appImportImport) ||
      contents.includes(storybookeToggleImport)
    ) {
      logger.warn(stripIndents`${mainFilePath} is already udpated.`);
      return;
    }
    host.write(
      mainFilePath,
      contents.replace(appImportImport, storybookeToggleImport)
    );
  } catch {
    logger.warn(
      stripIndents`Unable to update import in ${mainFilePath} for project ${root}.`
    );
  }
}
