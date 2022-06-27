import {
  joinPathFragments,
  names,
  normalizePath,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
} from '@nrwl/devkit';

export type ComponentGenerationOptions = {
  name: string;
  flat?: boolean;
  path?: string;
  project?: string;
  type?: string;
};
export type ComponentFileInfo = {
  componentDirectory: string;
  componentFileName: string;
  componentFilePath: string;
};

export function getComponentFileInfo(
  tree: Tree,
  options: ComponentGenerationOptions
): ComponentFileInfo {
  const project =
    options.project ?? readWorkspaceConfiguration(tree).defaultProject;
  const { root, sourceRoot, projectType } = readProjectConfiguration(
    tree,
    project
  );
  const { fileName: normalizedName } = names(options.name);

  const componentFileName = `${normalizedName}.${
    options.type ? names(options.type).fileName : 'component'
  }`;

  const projectSourceRoot = sourceRoot ?? joinPathFragments(root, 'src');
  const path =
    options.path ??
    joinPathFragments(
      projectSourceRoot,
      projectType === 'application' ? 'app' : 'lib'
    );
  const componentDirectory = options.flat
    ? normalizePath(path)
    : joinPathFragments(path, normalizedName);

  const componentFilePath = joinPathFragments(
    componentDirectory,
    `${componentFileName}.ts`
  );

  return { componentDirectory, componentFileName, componentFilePath };
}
