import {
  detectPackageManager,
  formatFiles,
  generateFiles,
  getPackageManagerCommand,
  names,
  NxJsonConfiguration,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { deduceDefaultBase } from '../../utilities/default-base';
import { join } from 'path';
import { getNxCloudUrl, isNxCloudUsed } from 'nx/src/utils/nx-cloud-utils';
import { isUsingTsSolutionSetup } from '../../utilities/typescript/ts-solution-setup';

export interface Schema {
  name: string;
  ci: 'github' | 'azure' | 'circleci' | 'bitbucket-pipelines' | 'gitlab';
}

export async function ciWorkflowGenerator(tree: Tree, schema: Schema) {
  const ci = schema.ci;
  const options = normalizeOptions(schema, tree);
  const nxJson: NxJsonConfiguration = readJson(tree, 'nx.json');

  if (ci === 'bitbucket-pipelines' && defaultBranchNeedsOriginPrefix(nxJson)) {
    appendOriginPrefix(nxJson);
  }

  generateFiles(tree, join(__dirname, 'files', ci), '', options);

  addWorkflowFileToSharedGlobals(nxJson, schema.ci, options.workflowFileName);

  writeJson(tree, 'nx.json', nxJson);

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
  hasCypress: boolean;
  hasE2E: boolean;
  hasTypecheck: boolean;
  hasPlaywright: boolean;
  tmpl: '';
  connectedToCloud: boolean;
  hasPnpmVersion: boolean;
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
  // check if packagejson has packagemanager and its pnpm
  const packageManagerPrefixPnpm = packageJson?.pnpm?.packageManager;
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const hasCypress = allDependencies['@nx/cypress'];
  const hasPlaywright = allDependencies['@nx/playwright'];
  const hasE2E = hasCypress || hasPlaywright;
  const hasTypecheck = isUsingTsSolutionSetup(tree);

  const connectedToCloud = isNxCloudUsed(readJson(tree, 'nx.json'));

  return {
    workflowName,
    workflowFileName,
    packageManager,
    packageManagerInstall,
    packageManagerPrefix,
    packageManagerPreInstallPrefix,
    mainBranch: deduceDefaultBase(),
    hasPnpmVersion:
      packageManagerPrefixPnpm && !!packageManagerPrefixPnpm?.split('@')[1],
    hasCypress,
    hasE2E,
    hasPlaywright,
    hasTypecheck,
    nxCloudHost,
    tmpl: '',
    connectedToCloud,
  };
}

function defaultBranchNeedsOriginPrefix(nxJson: NxJsonConfiguration): boolean {
  const base = nxJson.defaultBase ?? nxJson.affected?.defaultBase;
  return !base?.startsWith('origin/');
}

function appendOriginPrefix(nxJson: NxJsonConfiguration): void {
  if (nxJson?.affected?.defaultBase) {
    nxJson.affected.defaultBase = `origin/${nxJson.affected.defaultBase}`;
  }
  if (nxJson.defaultBase || !nxJson.affected) {
    nxJson.defaultBase = `origin/${nxJson.defaultBase ?? deduceDefaultBase()}`;
  }
}

const ciWorkflowInputs: Record<Schema['ci'], string> = {
  azure: 'azure-pipelines.yml',
  'bitbucket-pipelines': 'bitbucket-pipelines.yml',
  circleci: '.circleci/config.yml',
  github: '.github/workflows/',
  gitlab: '.gitlab-ci.yml',
};

function addWorkflowFileToSharedGlobals(
  nxJson: NxJsonConfiguration,
  ci: Schema['ci'],
  workflowFileName: string
): void {
  let input = `{workspaceRoot}/${ciWorkflowInputs[ci]}`;
  if (ci === 'github') input += `${workflowFileName}.yml`;
  nxJson.namedInputs ??= {};
  nxJson.namedInputs.sharedGlobals ??= [];
  nxJson.namedInputs.sharedGlobals.push(input);

  // Ensure 'default' named input exists and includes 'sharedGlobals'
  if (!nxJson.namedInputs.default) {
    nxJson.namedInputs.default = ['sharedGlobals'];
  } else if (
    Array.isArray(nxJson.namedInputs.default) &&
    !nxJson.namedInputs.default.includes('sharedGlobals')
  ) {
    nxJson.namedInputs.default.push('sharedGlobals');
  }
}
