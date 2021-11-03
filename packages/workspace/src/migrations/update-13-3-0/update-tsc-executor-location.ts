import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getProjects,
  installPackagesTask,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { nxVersion } from '../../utils/versions';

export async function updateTscExecutorLocation(
  host: Tree
): Promise<GeneratorCallback> {
  const projects = getProjects(host);
  let used = false;
  for (const [project, projectConfig] of projects.entries()) {
    for (const [target, targetConfig] of Object.entries(
      projectConfig.targets
    )) {
      if (targetConfig.executor === '@nrwl/workspace:tsc') {
        projectConfig.targets[target].executor = '@nrwl/js:tsc';
        updateProjectConfiguration(host, project, projectConfig);
        used = true;
      }
    }
  }
  if (used) {
    addDependenciesToPackageJson(
      host,
      {},
      {
        '@nrwl/js': nxVersion,
      }
    );
  }
  await formatFiles(host);
  return () => installPackagesTask(host);
}

export default updateTscExecutorLocation;
