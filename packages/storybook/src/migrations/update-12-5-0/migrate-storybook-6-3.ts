import {
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import { gte, lt } from 'semver';

let needsInstall = false;
const targetStorybookVersion = '6.3.0';

function getPackageVersion(json, packageName: string) {
  let packageVersion = json.dependencies[packageName];

  if (!packageVersion) {
    packageVersion = json.devDependencies[packageName];
  }

  if (packageVersion) {
    return checkAndCleanWithSemver(packageName, packageVersion);
  } else {
    return null;
  }
}

/**
 * Upgrades to Storybook v6.3 (if currently a 6.x version is installed).
 * Also for Angular projects makes sure the `@storybook/builder-webpack5` and `@storybook/manager-webpack5`
 * are installed
 */
function upgradeStorybook63(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.dependencies = json.dependencies || {};
    json.devDependencies = json.devDependencies || {};

    function updatePackageSection(
      storybookPackageName: string,
      packageSection: 'dependencies' | 'devDependencies'
    ) {
      if (json[packageSection][storybookPackageName]) {
        const version = checkAndCleanWithSemver(
          storybookPackageName,
          json[packageSection][storybookPackageName]
        );
        if (gte(version, '6.0.0') && lt(version, targetStorybookVersion)) {
          json[packageSection][
            storybookPackageName
          ] = `~${targetStorybookVersion}`;
          needsInstall = true;
        }
      }
    }

    const storybookPackages = [
      '@storybook/angular',
      '@storybook/react',
      '@storybook/addon-knobs',
      '@storybook/addon-controls',
    ];

    storybookPackages.forEach((storybookPackageName) => {
      updatePackageSection(storybookPackageName, 'dependencies');
      updatePackageSection(storybookPackageName, 'devDependencies');
    });

    // check if Angular & Angular 12 => install Storybook Webpack 5 deps
    const storybookAngularVersion = getPackageVersion(
      json,
      '@storybook/angular'
    );
    if (storybookAngularVersion && gte(storybookAngularVersion, '6.0.0')) {
      const angularVersion = getPackageVersion(json, '@angular/core');
      if (angularVersion && gte(angularVersion, '12.0.0')) {
        json.devDependencies[
          '@storybook/builder-webpack5'
        ] = `~${targetStorybookVersion}`;
        json.devDependencies[
          '@storybook/manager-webpack5'
        ] = `~${targetStorybookVersion}`;

        needsInstall = true;
      }
    }

    return json;
  });
}

function replaceStorybookAddonKnobRegistration(
  tree: Tree,
  storybookMainJSpath
) {
  let storybookMainContent = tree.read(storybookMainJSpath, 'utf-8');
  storybookMainContent = storybookMainContent.replace(
    /'(@storybook\/addon-knobs)\/register'/g,
    "'$1'"
  );

  tree.write(storybookMainJSpath, storybookMainContent);
}

function migrateKnobsRegistration(tree: Tree) {
  const projects = getProjects(tree);

  // we only need to migrate if we are on Storybook v6.3
  const json = readJson(tree, 'package.json');
  const storybookKnobVersion = getPackageVersion(
    json,
    '@storybook/addon-knobs'
  );

  if (storybookKnobVersion && gte(storybookKnobVersion, '6.3.0')) {
    // migrate the root config
    const rootStoryMainFilePath = `.storybook/main.js`;
    if (tree.exists(rootStoryMainFilePath)) {
      replaceStorybookAddonKnobRegistration(tree, rootStoryMainFilePath);
    }

    projects.forEach((projConfig, projName) => {
      const targets = projConfig.targets;
      const storybookMainJS = joinPathFragments(
        projConfig.root,
        '.storybook/main.js'
      );

      const storybookExecutor = Object.keys(targets).find(
        (x) => targets[x].executor === '@nrwl/storybook:storybook'
      );

      const hasStorybookConfig =
        storybookExecutor && tree.exists(storybookMainJS);

      if (!hasStorybookConfig) {
        return;
      }

      replaceStorybookAddonKnobRegistration(tree, storybookMainJS);
    });
  }
}

export default async function updateStorybookv63(tree: Tree) {
  upgradeStorybook63(tree);

  // we only need to migrate knobs if the current storybook version is 6.3 or higher
  migrateKnobsRegistration(tree);

  await formatFiles(tree);

  if (needsInstall) {
    logger.info(
      'Please make sure to run npm install or yarn install to get the latest packages added by this migration'
    );
  }
}
