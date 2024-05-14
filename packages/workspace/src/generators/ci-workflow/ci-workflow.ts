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
  packageManagerPreInstallPrefix: string;
  nxCloudHost: string;
  hasE2E: boolean;
  tmpl: '';
}

function normalizeOptions(options: Schema, tree: Tree): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name
  );
  const packageManager = detectPackageManager();
  const {
    exec: packageManagerPrefix,
    ciInstall: packageManagerInstall,
    dlx: packageManagerPreInstallPrefix,
  } = getPackageManagerCommand(packageManager);

  let nxCloudHost: string = 'nx.app';
  try {
    const nxCloudUrl = getNxCloudUrl(readJson(tree, 'nx.json'));
    nxCloudHost = new URL(nxCloudUrl).host;
  } catch {}

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
    packageManagerPreInstallPrefix,
    mainBranch: deduceDefaultBase(),
    hasE2E,
    nxCloudHost,
    tmpl: '',
  };
}

function defaultBranchNeedsOriginPrefix(nxJson: NxJsonConfiguration): boolean {
  const base = nxJson.defaultBase ?? nxJson.affected?.defaultBase;
  return !base?.startsWith('origin/');
}

function appendOriginPrefix(nxJson: NxJsonConfiguration): NxJsonConfiguration {
  if (nxJson?.affected?.defaultBase) {
    nxJson.affected.defaultBase = `origin/${nxJson.affected.defaultBase}`;
  }
  if (nxJson.defaultBase || !nxJson.affected) {
    nxJson.defaultBase = `origin/${nxJson.defaultBase ?? deduceDefaultBase()}`;
  }
  return nxJson;
}
