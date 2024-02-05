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
import { getNxCloudUrl } from 'nx/src/utils/nx-cloud-utils';

export interface Schema {
  name: string;
  ci: 'github' | 'azure' | 'circleci' | 'bitbucket-pipelines' | 'gitlab';
}

export async function ciWorkflowGenerator(tree: Tree, schema: Schema) {
  const ci = schema.ci;

  const nxJson: NxJsonConfiguration = readJson(tree, 'nx.json');
  const nxCloudUsed =
    nxJson.nxCloudAccessToken ??
    Object.values(nxJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
    );
  if (!nxCloudUsed) {
    throw new Error('This workspace is not connected to Nx Cloud.');
  }
  if (ci === 'bitbucket-pipelines' && defaultBranchNeedsOriginPrefix(nxJson)) {
    writeJson(tree, 'nx.json', appendOriginPrefix(nxJson));
  }

  const options = normalizeOptions(schema, tree);
  generateFiles(tree, join(__dirname, 'files', ci), '', options);
  await formatFiles(tree);
}

interface Substitutes {
  mainBranch: string;
  workflowName: string;
  workflowFileName: string;
  packageManager: string;
  packageManagerInstall: string;
  packageManagerPrefix: string;
  nxCloudHost: string;
  hasE2E: boolean;
  tmpl: '';
}

function normalizeOptions(options: Schema, tree: Tree): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name
  );
  const packageManager = detectPackageManager();
  const { exec: packageManagerPrefix, ciInstall: packageManagerInstall } =
    getPackageManagerCommand(packageManager);

  const nxCloudUrl = getNxCloudUrl(readJson(tree, 'nx.json'));
  const nxCloudHost = new URL(nxCloudUrl).host;

  const packageJson = readJson(tree, 'package.json');
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const hasE2E =
    allDependencies['@nx/cypress'] || allDependencies['@nx/playwright'];

  return {
    workflowName,
    workflowFileName,
    packageManager,
    packageManagerInstall,
    packageManagerPrefix,
    mainBranch: deduceDefaultBase(),
    hasE2E,
    nxCloudHost,
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
