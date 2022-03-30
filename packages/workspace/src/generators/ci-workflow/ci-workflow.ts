import { Tree } from '@nrwl/devkit';

export interface Schema {
  name?: string;
  ci: 'github' | 'azure' | 'circleci';
}

export async function ciWorkflowGenerator(tree: Tree, options: Schema) {
  // TODO: Implement
}
