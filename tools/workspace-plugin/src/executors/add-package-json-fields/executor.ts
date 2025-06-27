import { ExecutorContext } from '@nx/devkit';
import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';
import { join } from 'path';
import { existsSync } from 'fs';

export interface AddPackageJsonFieldsExecutorSchema {
  packageRoot?: string;
}

export default async function runExecutor(
  options: AddPackageJsonFieldsExecutorSchema,
  context: ExecutorContext
) {
  const projectName = context.projectName;
  if (!projectName) {
    throw new Error('Project name is required');
  }

  const packageRoot = options.packageRoot || `dist/packages/${projectName}`;
  const pkgPath = join(context.root, packageRoot, 'package.json');

  // Check if package.json exists
  if (!existsSync(pkgPath)) {
    console.log(
      `Package ${projectName} does not exist at ${pkgPath}, skipping`
    );
    return { success: true };
  }

  const packageJson = readJsonFile(pkgPath);
  let hasChanges = false;

  // Add types field if missing (use existing typings field or default to src/index.d.ts)
  if (!packageJson.types) {
    if (packageJson.typings) {
      packageJson.types = packageJson.typings;
      hasChanges = true;
      console.log(`Added types field: ${packageJson.types} in ${projectName}`);
    } else {
      packageJson.types = './src/index.d.ts';
      hasChanges = true;
      console.log(
        `Added default types field: ./src/index.d.ts in ${projectName}`
      );
    }
  }

  // Add type field if missing (defaulting to commonjs for existing packages)
  if (!packageJson.type) {
    packageJson.type = 'commonjs';
    hasChanges = true;
    console.log(`Added type field: commonjs in ${projectName}`);
  }

  if (hasChanges) {
    writeJsonFile(pkgPath, packageJson);
    console.log(`Updated package.json fields in ${projectName}`);
  } else {
    console.log(`No missing fields found in ${projectName}`);
  }

  return { success: true };
}
