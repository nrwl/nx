import { formatFiles, Tree, logger, updateJson } from '@nrwl/devkit';
import { join } from 'path';

let needsInstall = false;
const targetStorybookVersion = '6.3.0';

function installAddonEssentials(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.dependencies = json.dependencies || {};
    json.devDependencies = json.devDependencies || {};

    if (
      !json.dependencies['@storybook/addon-essentials'] &&
      !json.devDependencies['@storybook/addon-essentials']
    ) {
      needsInstall = true;
      json.devDependencies['@storybook/addon-essentials'] =
        targetStorybookVersion;
    }

    return json;
  });
}

function editRootMainJs(tree: Tree) {
  let newContent: string;
  const rootMainJsExists = tree.exists(`.storybook/main.js`);
  if (rootMainJsExists) {
    const rootMainJs = require(join(tree.root, '.storybook/main.js'));
    const addonsArray: string[] = rootMainJs?.addons;
    if (addonsArray) {
      if (!addonsArray.includes('@storybook/addon-essentials')) {
        addonsArray.push('@storybook/addon-essentials');
        rootMainJs.addons = addonsArray;
      }
    } else {
      rootMainJs.addons = ['@storybook/addon-essentials'];
    }
    newContent = `
    module.exports = ${JSON.stringify(rootMainJs)}
    `;
  } else {
    newContent = `
    module.exports = {
      stories: [],
      addons: ['@storybook/addon-essentials'],
    };
    `;
  }
  tree.write(`.storybook/main.js`, newContent);
}

export default async function (tree: Tree) {
  editRootMainJs(tree);
  installAddonEssentials(tree);
  await formatFiles(tree);

  if (needsInstall) {
    logger.info(
      'Please make sure to run npm install or yarn install to get the latest packages added by this migration'
    );
  }
}
