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

function getNxCloudRecordCommand(
  ci: Schema['ci'],
  packageManagerPrefix: string
): Command {
  const baseCommand = `${packageManagerPrefix} nx-cloud record -- echo Hello World`;
  const prefix = getCiPrefix(ci);
  const exampleComment = `${prefix}${baseCommand}`;

  return {
    comments: [
      `Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud`,
      exampleComment,
    ],
  };
}

function getNxTasksCommand(
  ci: Schema['ci'],
  packageManagerPrefix: string,
  mainBranch: string,
  hasTypecheck: boolean,
  hasE2E: boolean,
  useRunMany: boolean = false
): Command {
  const tasks = `lint test build${hasTypecheck ? ' typecheck' : ''}${
    hasE2E ? ' e2e' : ''
  }`;

  const commandType = useRunMany ? 'run-many' : 'affected';
  const nxCommandComments = hasE2E
    ? [`When you enable task distribution, run the e2e-ci task instead of e2e`]
    : [];

  const args = getCiArgs(ci, mainBranch, useRunMany);
  const nxCommand = `${packageManagerPrefix} nx ${commandType} ${args}-t ${tasks}`;

  return {
    comments: nxCommandComments,
    command: nxCommand,
  };
}

function getNxCloudFixCiCommand(packageManagerPrefix: string): Command {
  return {
    comments: [
      `Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci`,
    ],
    command: `${packageManagerPrefix} nx fix-ci`,
    alwaysRun: true,
  };
}

function getCiCommands(
  ci: Schema['ci'],
  packageManagerPrefix: string,
  mainBranch: string,
  hasTypecheck: boolean,
  hasE2E: boolean,
  useRunMany: boolean = false
): Command[] {
  return [
    getNxCloudRecordCommand(ci, packageManagerPrefix),
    getNxTasksCommand(
      ci,
      packageManagerPrefix,
      mainBranch,
      hasTypecheck,
      hasE2E,
      useRunMany
    ),
    getNxCloudFixCiCommand(packageManagerPrefix),
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

function getCiArgs(
  ci: Schema['ci'],
  mainBranch: string,
  useRunMany: boolean = false
): string {
  // When using run-many, we don't need base/head SHA args
  if (useRunMany) {
    return '';
  }

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

  // Build nx command comments and command
  const commandType = useRunMany ? 'run-many' : 'affected';

  // Build command with conditional base arg
  const baseArg = useRunMany ? '' : ' --base=HEAD~1';
  const command = `${packageManagerPrefix} nx ${commandType} -t ${tasks}${baseArg}`;

  return [
    {
      comments: nxCloudComments,
    },
    {
      command,
    },
  ];
}

export type Command = {
  command?: string;
  comments?: string[];
  alwaysRun?: boolean;
};

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
  useRunMany: boolean;
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
    useRunMany: options.useRunMany ?? false,
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
