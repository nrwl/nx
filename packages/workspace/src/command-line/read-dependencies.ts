import {
  getProjectMTime,
  lastModifiedAmongProjectFiles,
  mtime,
  readPackageJson
} from './shared-utils';
import { mkdirSync, readFileSync } from 'fs';
import { directoryExists, fileExists, readJsonFile } from '../utils/fileutils';
import { appRootPath } from '../utils/app-root';
import {
  Dependencies,
  NxDepsJson,
  PackageJson,
  ProjectNode
} from './shared-models';
import { DepsCalculator } from './deps-calculator/deps-calculator';

export function readDependencies(
  npmScope: string,
  projectNodes: ProjectNode[]
): Dependencies {
  const nxDepsPath = `${appRootPath}/dist/nxdeps.json`;
  const m = lastModifiedAmongProjectFiles(projectNodes);
  if (!directoryExists(`${appRootPath}/dist`)) {
    mkdirSync(`${appRootPath}/dist`);
  }
  const existingDeps = fileExists(nxDepsPath) ? readJsonFile(nxDepsPath) : null;
  if (!existingDeps || m > mtime(nxDepsPath)) {
    const packageJson = readPackageJson();
    return dependencies(
      npmScope,
      projectNodes,
      existingDeps,
      packageJson,
      (f: string) => readFileSync(`${appRootPath}/${f}`, 'UTF-8')
    );
  } else {
    return existingDeps.dependencies;
  }
}

/**
 * DO NOT USE
 * Only exported for unit testing
 *
 * USE `readDependencies`
 */
export function dependencies(
  npmScope: string,
  projects: ProjectNode[],
  existingDependencies: NxDepsJson | null,
  packageJson: PackageJson,
  fileRead: (s: string) => string
): Dependencies {
  const nxDepsPath = `${appRootPath}/dist/nxdeps.json`;
  const nxDepsExists = fileExists(nxDepsPath);
  const nxDepsMTime = nxDepsExists ? mtime(nxDepsPath) : -Infinity;
  const calculator = new DepsCalculator(
    npmScope,
    projects,
    existingDependencies,
    packageJson,
    fileRead
  );
  projects
    .filter(
      project =>
        !calculator.incrementalEnabled ||
        getProjectMTime(project) >= nxDepsMTime
    )
    .forEach(project => {
      project.files
        .filter(
          file =>
            !calculator.incrementalEnabled ||
            !project.fileMTimes[file] ||
            project.fileMTimes[file] >= nxDepsMTime
        )
        .forEach(file => {
          calculator.processFile(file);
        });
    });
  calculator.commitDeps(nxDepsPath);
  return calculator.getDeps();
}
