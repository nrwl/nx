import {
  formatFiles,
  getProjects,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import type { Schema } from './schema';
import applicationGenerator from '../application/application';
import { getMFProjects } from '../../utils/get-mf-projects';
import { normalizeProjectName } from '../utils/project';
import { setupMf } from '../setup-mf/setup-mf';
import { E2eTestRunner } from '../../utils/test-runners';

function findNextAvailablePort(tree: Tree) {
  const mfProjects = getMFProjects(tree);

  const ports = new Set<number>([4200]);
  for (const mfProject of mfProjects) {
    const { targets } = readProjectConfiguration(tree, mfProject);
    const port = targets?.serve?.options?.port ?? 4200;
    ports.add(port);
  }

  const nextAvailablePort = Math.max(...ports) + 1;

  return nextAvailablePort;
}

export async function remote(tree: Tree, options: Schema) {
  const projects = getProjects(tree);
  if (options.host && !projects.has(options.host)) {
    throw new Error(
      `The name of the application to be used as the host app does not exist. (${options.host})`
    );
  }

  const appName = normalizeProjectName(options.name, options.directory);
  const port = options.port ?? findNextAvailablePort(tree);

  const installTask = await applicationGenerator(tree, {
    ...options,
    routing: true,
    skipDefaultProject: true,
    port,
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;

  await setupMf(tree, {
    appName,
    mfType: 'remote',
    routing: true,
    host: options.host,
    port,
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${appName}-e2e`,
    standalone: options.standalone,
  });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default remote;
