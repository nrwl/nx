import {
  Tree,
  names,
  generateFiles,
  joinPathFragments,
  getPackageManagerCommand,
  readJson,
  NxConfiguration,
  formatFiles,
  writeJson,
} from '@nrwl/devkit';
import { deduceDefaultBase } from '../../utilities/default-base';

export interface Schema {
  name?: string;
  ci: 'github' | 'azure' | 'circleci' | 'bitbucket-pipelines';
}

export async function ciWorkflowGenerator(host: Tree, schema: Schema) {
  const ci = schema.ci;
  const options = normalizeOptions(schema);

  const nxConfig: NxConfiguration = readJson(host, 'nx.json');
  const nxCloudUsed = Object.values(nxConfig.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
  if (!nxCloudUsed) {
    throw new Error('This workspace is not connected to Nx Cloud.');
  }

  if (ci === 'bitbucket-pipelines' && defaultBranchNeedsOriginPrefix(nxConfig)) {
    writeJson(host, 'nx.json', appendOriginPrefix(nxConfig));
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

function defaultBranchNeedsOriginPrefix(nxConfig: NxConfiguration): boolean {
  return !nxConfig.affected?.defaultBase?.startsWith('origin/');
}

function appendOriginPrefix(nxConfig: NxConfiguration): NxConfiguration {
  return {
    ...nxConfig,
    affected: {
      ...(nxConfig.affected ?? {}),
      defaultBase: nxConfig.affected?.defaultBase
        ? `origin/${nxConfig.affected.defaultBase}`
        : 'origin/main',
    },
  };
}
