import { readJsonFile, type TargetConfiguration } from '@nx/devkit';
import { existsSync } from 'node:fs';
import { type PackageManagerCommands } from 'nx/src/utils/package-manager';
import { join } from 'path';

/**
 * Allow uses that use incremental builds to run `nx watch-deps` to continuously build all dependencies.
 */
export function addBuildAndWatchDepsTargets(
  workspaceRoot: string,
  projectRoot: string,
  targets: Record<string, TargetConfiguration>,
  options: { buildDepsTargetName?: string; watchDepsTargetName?: string },
  pmc: PackageManagerCommands
): void {
  let projectName: string;

  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');

  if (existsSync(projectJsonPath)) {
    const projectJson = readJsonFile(projectJsonPath);
    projectName = projectJson.name;
  } else if (existsSync(packageJsonPath)) {
    const packageJson = readJsonFile(packageJsonPath);
    projectName = packageJson.nx?.name ?? packageJson.name;
  }

  if (!projectName) return;

  if (projectName) {
    const buildDepsTargetName = options.buildDepsTargetName ?? 'build-deps';
    targets[buildDepsTargetName] = {
      dependsOn: ['^build'],
    };
    targets[options.watchDepsTargetName ?? 'watch-deps'] = {
      dependsOn: [buildDepsTargetName],
      command: `${pmc.exec} nx watch --projects ${projectName} --includeDependentProjects -- ${pmc.exec} nx ${buildDepsTargetName} ${projectName}`,
    };
  }
}
