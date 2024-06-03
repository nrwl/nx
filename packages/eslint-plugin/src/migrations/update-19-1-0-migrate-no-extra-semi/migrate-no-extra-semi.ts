import {
  Tree,
  formatFiles,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';

export default async function migrate(tree: Tree): Promise<void> {
  visitNotIgnoredFiles(tree, '.', (path) => {
    if (!path.endsWith('.eslintrc.json')) {
      return;
    }

    // Cheap check to see if the file contains references to the nx TS or JS eslint configs
    const fileContents = tree.read(path, 'utf-8');
    if (
      !fileContents.includes('@nx/typescript') &&
      !fileContents.includes('@nx/javascript')
    ) {
      return;
    }

    let wasUpdated = false;
    updateJson(tree, path, (json) => {
      // Update top level config
      wasUpdated = addNoExtraSemiExplicitly(json);
      // Update overrides
      if (json.overrides) {
        for (const override of json.overrides) {
          const overrideUpdated = addNoExtraSemiExplicitly(override);
          wasUpdated = wasUpdated || overrideUpdated;
        }
      }
      return json;
    });

    if (wasUpdated) {
      console.warn(
        `NOTE: The configuration for @typescript-eslint/no-extra-semi and no-extra-semi that you were previously inheriting from the Nx eslint-plugin has been explicitly added to your ${path} file.
  
This is because those rules have been migrated to the https://eslint.style/ project (for stylistic only rules) and will no longer work in v8 of typescript-eslint. Having them explicitly in your config will make it easier for you to handle the transition, either by starting to use the ESLint Stylistic plugin, or removing the rules from your config.`
      );
    }
  });

  await formatFiles(tree);
}

/**
 * @returns {boolean} whether the json was updated
 */
function addNoExtraSemiExplicitly(json: Record<string, any>): boolean {
  let wasUpdated = false;
  if (
    !json.extends?.includes('@nx/typescript') &&
    !json.extends?.includes('plugin:@nx/typescript') &&
    !json.extends?.includes('@nx/javascript') &&
    !json.extends?.includes('plugin:@nx/javascript')
  ) {
    return wasUpdated;
  }
  if (!json.rules?.['@typescript-eslint/no-extra-semi']) {
    json.rules ??= {};
    json.rules['@typescript-eslint/no-extra-semi'] = 'error';
    wasUpdated = true;
  }
  if (!json.rules?.['no-extra-semi']) {
    json.rules ??= {};
    json.rules['no-extra-semi'] = 'off';
    wasUpdated = true;
  }
  return wasUpdated;
}
