import { Tree } from '@angular-devkit/schematics';
import { getWorkspace, toFileName } from '@nrwl/workspace';

export async function normalizeProjectOptions(
  host: Tree,
  schema: any
): Promise<any> {
  const workspace = await getWorkspace(host);
  const project = workspace.projects.get(schema.project as string);

  const name = toFileName(schema.name);

  const fileName = name.replace(new RegExp('/', 'g'), '-');

  const parsedTags = schema.tags
    ? schema.tags.split(',').map(s => s.trim())
    : [];

  const normalized = {
    ...schema,
    fileName,
    name,
    projectRoot: project.root,
    projectDirectory: project.sourceRoot,
    parsedTags
  };

  return normalized;
}
