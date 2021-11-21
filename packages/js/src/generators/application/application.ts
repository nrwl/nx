import { convertNxGenerator, getWorkspaceLayout, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { projectGenerator } from '../../utils/project-generator';
import { GeneratorSchema } from '../../utils/schema';

export async function applicationGenerator(
  tree: Tree,
  schema: GeneratorSchema
) {
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
