import {
  Tree,
  names,
  generateFiles,
  getPackageManagerCommand,
  NxJsonConfiguration,
  formatFiles,
  detectPackageManager,
  readNxJson,
  readJson,
} from '@nx/devkit';
import { join } from 'path';
import { getNxCloudUrl, isNxCloudUsed } from 'nx/src/utils/nx-cloud-utils';
import { deduceDefaultBase } from 'nx/src/utils/default-base';

function getCiCommands(ci: Schema['ci'], mainBranch: string): string[] {
  switch (ci) {
    case 'circleci': {
      return [`./nx affected --base=$NX_BASE --head=$NX_HEAD -t test build`];
    }
    default: {
      return [`./nx affected -t test build`];
    }
  }
}

export interface Schema {
  name: string;
  ci: 'github' | 'circleci';
  packageManager?: null;
  commands?: string[];
}

export async function ciWorkflowGenerator(tree: Tree, schema: Schema) {
  const ci = schema.ci;

  const options = getTemplateData(tree, schema);
  generateFiles(tree, join(__dirname, 'files', ci), '', options);
  await formatFiles(tree);
}

interface Substitutes {
  mainBranch: string;
  workflowName: string;
  workflowFileName: string;
  packageManager: string;
  packageManagerPrefix: string;
  commands: string[];
  nxCloudHost: string;
}

function getTemplateData(tree: Tree, options: Schema): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name
  );
  const packageManager = detectPackageManager();
  const { exec: packageManagerPrefix } =
    getPackageManagerCommand(packageManager);

  let nxCloudHost: string = 'nx.app';
  try {
    const nxCloudUrl = getNxCloudUrl(readJson(tree, 'nx.json'));
    nxCloudHost = new URL(nxCloudUrl).host;
  } catch {}

  const mainBranch = deduceDefaultBase();

  const commands = options.commands ?? getCiCommands(options.ci, mainBranch);

  return {
    workflowName,
    workflowFileName,
    packageManager,
    packageManagerPrefix,
    commands,
    mainBranch,
    nxCloudHost,
  };
}

export default ciWorkflowGenerator;
