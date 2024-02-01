import { Tree, getProjects, names, offsetFromRoot } from '@nx/devkit';
import { WebConfigurationGeneratorSchema } from '../schema';

export interface NormalizedSchema extends WebConfigurationGeneratorSchema {
  projectRoot: string;
  fileName: string;
  className: string;
}

export function normalizeSchema(
  tree: Tree,
  schema: WebConfigurationGeneratorSchema
) {
  const project = getProjects(tree).get(schema.project);
  const { fileName, className } = names(schema.project);
  return {
    ...schema,
    projectRoot: project.root,
    offsetFromRoot: offsetFromRoot(project.root),
    fileName,
    className,
  };
}
