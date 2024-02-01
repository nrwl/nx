import {
  Tree,
  names,
  generateFiles,
  getPackageManagerCommand,
  readJson,
  NxJsonConfiguration,
  formatFiles,
  writeJson,
  detectPackageManager,
} from '@nx/devkit';
import { deduceDefaultBase } from '../../utilities/default-base';
import { join } from 'path';

export interface Schema {
  name: string;
  ci: 'github' | 'azure' | 'circleci' | 'bitbucket-pipelines' | 'gitlab';
}

export async function ciWorkflowGenerator(host: Tree, schema: Schema) {
  const ci = schema.ci;

  const nxJson: NxJsonConfiguration = readJson(host, 'nx.json');
  const nxCloudUsed =
    nxJson.nxCloudAccessToken ??
    Object.values(nxJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
    );
  if (!nxCloudUsed) {
    throw new Error('This workspace is not connected to Nx Cloud.');
  }
  const packageJson = readJson(host, 'package.json');
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const hasE2E =
    allDependencies['@nrwl/cypress'] || allDependencies['@nrwl/playwright'];

  if (ci === 'bitbucket-pipelines' && defaultBranchNeedsOriginPrefix(nxJson)) {
    writeJson(host, 'nx.json', appendOriginPrefix(nxJson));
  }

  const options = normalizeOptions(schema, hasE2E);
  generateFiles(host, join(__dirname, 'files', ci), '', options);
  await formatFiles(host);
}

interface Substitutes {
  mainBranch: string;
  workflowName: string;
  workflowFileName: string;
  packageManager: string;
  packageManagerInstall: string;
  packageManagerPrefix: string;
  hasE2E: boolean;
  tmpl: '';
}

function normalizeOptions(options: Schema, hasE2E): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name
  );
  const packageManager = detectPackageManager();
  const { exec: packageManagerPrefix, ciInstall: packageManagerInstall } =
    getPackageManagerCommand(packageManager);

  return {
    workflowName,
    workflowFileName,
    packageManager,
    packageManagerInstall,
    packageManagerPrefix,
    mainBranch: deduceDefaultBase(),
    hasE2E,
    tmpl: '',
  };
}

function defaultBranchNeedsOriginPrefix(nxJson: NxJsonConfiguration): boolean {
  return !nxJson.affected?.defaultBase?.startsWith('origin/');
}

function appendOriginPrefix(nxJson: NxJsonConfiguration): NxJsonConfiguration {
  return {
    ...nxJson,
    affected: {
      ...(nxJson.affected ?? {}),
      defaultBase: nxJson.affected?.defaultBase
        ? `origin/${nxJson.affected.defaultBase}`
        : 'origin/main',
    },
  };
}
