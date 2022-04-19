import {
  Tree,
  names,
  generateFiles,
  joinPathFragments,
  getPackageManagerCommand,
} from '@nrwl/devkit';
import { deduceDefaultBase } from '../../utilities/default-base';

export interface Schema {
  name?: string;
  ci: 'github' | 'azure' | 'circleci';
}

export async function ciWorkflowGenerator(host: Tree, schema: Schema) {
  const ci = schema.ci;
  const options = normalizeOptions(schema);

  generateFiles(host, joinPathFragments(__dirname, 'files', ci), '', options);
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
    options.name || 'build'
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
