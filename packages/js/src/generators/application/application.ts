import { convertNxGenerator, getWorkspaceLayout, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { projectGenerator } from '../../utils/project-generator';
import { Schema } from '../../utils/schema';

export async function applicationGenerator(tree: Tree, schema: Schema) {
  const { appsDir } = getWorkspaceLayout(tree);
  return projectGenerator(
    tree,
    { ...schema, buildable: true, skipTsConfig: true },
    appsDir,
    join(__dirname, './files'),
    'application'
  );
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
