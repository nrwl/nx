import {
  GeneratorCallback,
  installPackagesTask,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { checkAndCleanWithSemver } from '@nrwl/workspace';
import { gte, lt } from 'semver';

export function updateCypressVersionIf10(tree: Tree): GeneratorCallback {
  const installedVersion = readJson(tree, 'package.json').devDependencies?.[
    'cypress'
  ];

  if (!installedVersion) {
    return;
  }
  const normalizedInstalledCypressVersion = checkAndCleanWithSemver(
    'cypress',
    installedVersion
  );

  // not using v10
  if (
    lt(normalizedInstalledCypressVersion, '10.0.0') ||
    gte(normalizedInstalledCypressVersion, '11.0.0')
  ) {
    return;
  }

  const ngComponentTestingVersion = '10.7.0';

  if (lt(normalizedInstalledCypressVersion, ngComponentTestingVersion)) {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['cypress'] = `^${ngComponentTestingVersion}`;
      return json;
    });
    return () => {
      installPackagesTask(tree);
    };
  }
}

export default updateCypressVersionIf10;
