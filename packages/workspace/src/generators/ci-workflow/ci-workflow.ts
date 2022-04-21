import {
  Tree,
  names,
  generateFiles,
  joinPathFragments,
  getPackageManagerCommand,
  readJson,
  NxJsonConfiguration,
  formatFiles,
} from '@nrwl/devkit';
import { deduceDefaultBase } from '../../utilities/default-base';

export interface Schema {
  name?: string;
  ci: 'github' | 'azure' | 'circleci';
}

export async function ciWorkflowGenerator(host: Tree, schema: Schema) {
  const ci = schema.ci;
  const options = normalizeOptions(schema);

  const nxJson: NxJsonConfiguration = readJson(host, 'nx.json');
  const nxCloudUsed = Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
  if (!nxCloudUsed) {
    throw new Error('This workspace is not connected to Nx Cloud.');
  }

  generateFiles(host, joinPathFragments(__dirname, 'files', ci), '', options);
  await formatFiles(host);
}

interface Substitutes {
  mainBranch: string;
  workflowName: string;
  workflowFileName: string;
  packageManagerInstall: string;
  packageManagerPrefix: string;
  tmpl: '';
}

function normalizeOptions(options: Schema): Substitutes {
  const { name: workflowName, fileName: workflowFileName } = names(
    options.name || 'CI'
  );
  const { exec: packageManagerPrefix, ciInstall: packageManagerInstall } =
    getPackageManagerCommand();
  return {
    workflowName,
    workflowFileName,
    packageManagerInstall,
    packageManagerPrefix,
    mainBranch: deduceDefaultBase(),
    tmpl: '',
  };
}
