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

function getCiCommands(
  ci: Schema['ci'],
  packageManagerPrefix: string,
  mainBranch: string,
  hasTypecheck: boolean,
  hasE2E: boolean,
  useRunMany: boolean = false
): Command[] {
  // Build task list
  const tasks = `lint test build${hasTypecheck ? ' typecheck' : ''}${
    hasE2E ? ' e2e' : ''
  }`;

  // Create nx-cloud record example comment with CI-specific prefix
  const baseCommand = `${packageManagerPrefix} nx-cloud record -- echo Hello World`;
  const prefix = getCiPrefix(ci);
  const exampleComment = `${prefix}${baseCommand}`;

  // Build nx-cloud record comments
  const nxCloudComments = [
    `Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud`,
    exampleComment,
  ];

  // Build nx command comments and command
  const commandType = useRunMany ? 'run-many' : 'affected';
  const nxCommandComments = useRunMany
    ? [
        `As your workspace grows, you can change this to use Nx Affected to run only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected`,
      ]
    : [
        `Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected`,
      ];

  if (hasE2E) {
    nxCommandComments.push(
      `When you enable task distribution, run the e2e-ci task instead of e2e`
    );
  }

  // Build nx command with CI-specific args
  const args = getCiArgs(ci, mainBranch);
  const nxCommand = `${packageManagerPrefix} nx ${commandType} ${args}-t ${tasks}`;

  return [
    {
      comments: nxCloudComments,
    },
    {
      comments: nxCommandComments,
      command: nxCommand,
    },
  ];
}

function getCiPrefix(ci: Schema['ci']): string {
  if (ci === 'github' || ci === 'circleci') {
    return '- run: ';
  } else if (ci === 'azure') {
    return '- script: ';
  } else if (ci === 'gitlab') {
    return '- ';
  }
  // Bitbucket expects just the command without prefix for pull requests
  return '';
}

function getCiArgs(ci: Schema['ci'], mainBranch: string): string {
  if (ci === 'azure') {
    return '--base=$(BASE_SHA) --head=$(HEAD_SHA) ';
  } else if (ci === 'bitbucket-pipelines') {
    return `--base=origin/${mainBranch} `;
  }
  return '';
}

function getBitbucketBranchCommands(
  packageManagerPrefix: string,
  hasTypecheck: boolean,
  hasE2E: boolean,
  useRunMany: boolean = false
): Command[] {
  const tasks = `lint test build${hasTypecheck ? ' typecheck' : ''}${
    hasE2E ? ' e2e-ci' : ''
  }`;

  const nxCloudComments = [
    `Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud`,
    `- ${packageManagerPrefix} nx-cloud record -- echo Hello World`,
  ];

  // BitBucket branches always use affected for now, regardless of useRunMany flag
  const nxAffectedComments = [
    `Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected`,
  ];

  return [
    {
      comments: nxCloudComments,
    },
    {
      comments: nxAffectedComments,
      command: `${packageManagerPrefix} nx affected -t ${tasks} --base=HEAD~1`,
    },
  ];
}

export type Command = { command?: string; comments?: string[] };

export interface Schema {
  name: string;
  ci: 'github' | 'azure' | 'circleci' | 'bitbucket-pipelines' | 'gitlab';
  useRunMany?: boolean;
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
  packageManagerVersion: string;
  commands: Command[];
  branchCommands?: Command[];
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

  const hasCypress = allDependencies['@nx/cypress'];
  const hasPlaywright = allDependencies['@nx/playwright'];
  const hasE2E = hasCypress || hasPlaywright;
  const hasTypecheck = isUsingTsSolutionSetup(tree);

  const connectedToCloud = isNxCloudUsed(readJson(tree, 'nx.json'));

  const mainBranch = deduceDefaultBase();
  const commands = getCiCommands(
    options.ci,
    packageManagerPrefix,
    mainBranch,
    hasTypecheck,
    hasE2E,
    options.useRunMany ?? false
  );
  const branchCommands =
    options.ci === 'bitbucket-pipelines'
      ? getBitbucketBranchCommands(
          packageManagerPrefix,
          hasTypecheck,
          hasE2E,
          options.useRunMany ?? false
        )
      : undefined;

  return {
    workflowName,
    workflowFileName,
    packageManager,
    packageManagerInstall,
    packageManagerPrefix,
    packageManagerPreInstallPrefix,
    mainBranch,
    packageManagerVersion: packageJson?.packageManager?.split('@')[1],
    hasCypress,
    hasE2E,
    hasPlaywright,
    hasTypecheck,
    nxCloudHost,
    tmpl: '',
    connectedToCloud,
    commands,
    branchCommands,
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
