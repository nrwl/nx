import {
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
} from '@nrwl/devkit';

export type GenerationOptions = {
  name: string;
  flat?: boolean;
  path?: string;
  project?: string;
  type?: string;
};
export type FileInfo = {
  directory: string;
  fileName: string;
  filePath: string;
};

export function getComponentFileInfo(
  tree: Tree,
  options: GenerationOptions
): FileInfo {
  return getFileInfo(tree, options, 'component');
}

export function getDirectiveFileInfo(
  tree: Tree,
  options: GenerationOptions
): FileInfo {
  return getFileInfo(tree, options, 'directive');
}

export function getPipeFileInfo(
  tree: Tree,
  options: GenerationOptions
): FileInfo {
  return getFileInfo(tree, options, 'pipe');
}

function getFileInfo(
  tree: Tree,
  options: GenerationOptions,
  defaultType: string
): FileInfo {
  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    project
  );
  const { fileName: normalizedName } = names(options.name);

  const fileName = `${normalizedName}.${
    options.type ? names(options.type).fileName : defaultType
  }`;

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib'
    );
  const directory = options.flat
    ? normalizePath(path)
    : joinPathFragments(path, normalizedName);

  const filePath = joinPathFragments(directory, `${fileName}.ts`);

  return { directory, fileName, filePath };
}
