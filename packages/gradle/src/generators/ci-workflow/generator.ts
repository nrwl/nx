import {
  Tree,
  names,
  generateFiles,
  getPackageManagerCommand,
  NxJsonConfiguration,
  formatFiles,
  detectPackageManager,
  readNxJson,
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

  const nxJson: NxJsonConfiguration = readNxJson(tree);
  const nxCloudUsed = isNxCloudUsed(nxJson);
  if (!nxCloudUsed) {
    throw new Error('This workspace is not connected to Nx Cloud.');
  }

  const options = getTemplateData(schema, nxJson);
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

function getTemplateData(
  options: Schema,
  nxJson: NxJsonConfiguration
): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name
  );
  const packageManager = detectPackageManager();
  const { exec: packageManagerPrefix } =
    getPackageManagerCommand(packageManager);

  const nxCloudUrl = getNxCloudUrl(nxJson);
  const nxCloudHost = new URL(nxCloudUrl).host;

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
