import type { ExecutorContext } from '@nrwl/devkit';
import {
  writeJsonFile,
  createPackageJson as generatePackageJson,
  createLockFile,
} from '@nrwl/devkit';
import { writeFileSync } from 'fs';
import { getLockFileName } from 'nx/src/lock-file/lock-file';
import type { NextBuildBuilderOptions } from '../../../utils/types';

export async function createPackageJson(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  const packageJson = generatePackageJson(
    context.projectName,
    context.projectGraph,
    {
      root: context.root,
      // By default we remove devDependencies since this is a production build.
      isProduction: options.includeDevDependenciesInPackageJson,
    }
  );

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.start = 'next start';

  const typescriptNode = context.projectGraph.externalNodes['npm:typescript'];
  if (typescriptNode) {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies['typescript'] = typescriptNode.data.version;
  }

  writeJsonFile(`${options.outputPath}/package.json`, packageJson);

  // generate lock file
  const prunedLockFile = createLockFile(packageJson);
  const lockFileName = getLockFileName();
  writeFileSync(`${options.outputPath}/${lockFileName}`, prunedLockFile, {
    encoding: 'utf-8',
  });
}
