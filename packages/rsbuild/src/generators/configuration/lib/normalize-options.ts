import {
  joinPathFragments,
  type Tree,
  type ProjectConfiguration,
} from '@nx/devkit';
import { type Schema } from '../schema';
import { relative } from 'path';

export interface NormalizedOptions extends Schema {
  entry: string;
  target: 'node' | 'web' | 'web-worker';
  devServerPort: number;
  tsConfig: string;
  projectRoot: string;
}

export async function normalizeOptions(
  tree: Tree,
  schema: Schema,
  project: ProjectConfiguration
) {
  // Paths should be relative to the project root because inferred task will run from project root
  let options: NormalizedOptions = {
    ...schema,
    target: schema.target ?? 'web',
    entry: normalizeRelativePath(
      schema.entry ?? './src/index.ts',
      project.root
    ),
    tsConfig: normalizeRelativePath(
      schema.tsConfig ?? './tsconfig.json',
      project.root
    ),
    devServerPort: schema.devServerPort ?? 4200,
    projectRoot: project.root,
    skipFormat: schema.skipFormat ?? false,
    skipValidation: schema.skipValidation ?? false,
  };

  if (!schema.tsConfig) {
    const possibleTsConfigPaths = [
      './tsconfig.app.json',
      './tsconfig.lib.json',
      './tsconfig.json',
    ];
    const tsConfigPath = possibleTsConfigPaths.find((p) =>
      tree.exists(joinPathFragments(project.root, p))
    );
    options.tsConfig = tsConfigPath ?? undefined;
  }

  return options;
}

function normalizeRelativePath(filePath: string, projectRoot: string) {
  if (filePath.startsWith('./')) {
    return filePath;
  }
  filePath = filePath.startsWith(projectRoot)
    ? relative(projectRoot, filePath)
    : filePath;
  return `./${filePath}`;
}
