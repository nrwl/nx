import {
  PackageManager,
  Tree,
  detectPackageManager,
  getProjects,
  logger,
  offsetFromRoot,
  updateJson,
} from '@nx/devkit';
import { addEasScripts } from '../../generators/application/lib/add-eas-scripts';
import { join } from 'path';

/**
 * Update app's package.json to use eas-build-pre-install and eas-build-post-install scripts.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);
  const packageManagerLockFile: Record<PackageManager, string> = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml',
  };

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['start']?.executor === '@nrwl/expo:start' ||
      config.targets?.['start']?.executor === '@nx/expo:start'
    ) {
      try {
        addEasScripts(tree);
        updateJson(tree, join(config.root, 'package.json'), (packageJson) => {
          if (packageJson.scripts?.['postinstall']) {
            delete packageJson.scripts['postinstall'];
          }
          const packageManager = detectPackageManager(tree.root);
          const packageLockFile = packageManagerLockFile[packageManager];
          const offset = offsetFromRoot(config.root);
          packageJson.scripts = {
            ...packageJson.scripts,
            'eas-build-pre-install': `cd ${offset} && node tools/scripts/eas-build-pre-install.mjs . ${config.root} && cp ${packageLockFile} ${config.root}`,
            'eas-build-post-install': `cd ${offset} && node tools/scripts/eas-build-post-install.mjs . ${config.root}`,
          };
          return packageJson;
        });
      } catch {
        logger.error(`Unable to update package.json for project ${name}.`);
      }
    }
  }
}
