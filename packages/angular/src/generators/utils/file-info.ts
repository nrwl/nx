import {
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

export type GenerationOptions = {
  name: string;
  project: string;
  flat?: boolean;
  path?: string;
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
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    options.project
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
