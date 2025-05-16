import {
  joinPathFragments,
  names,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { basename } from 'node:path';
import { getInstalledAngularVersionInfo } from './version-utils';

export type ComponentMetadata = {
  fileName: string;
  extensionlessFileName: string;
  path: string;
  symbolName: string;
};

export function getAppComponentInfo(
  tree: Tree,
  componentFileSuffix: string,
  project: ProjectConfiguration
): ComponentMetadata {
  return getComponentInfo(tree, 'app', componentFileSuffix, project);
}

export function getNxWelcomeComponentInfo(
  tree: Tree,
  componentFileSuffix: string,
  project: ProjectConfiguration
): ComponentMetadata {
  return getComponentInfo(tree, 'nx-welcome', componentFileSuffix, project);
}

// TODO(leo): follow this up and improve it by using static analysis
function getComponentInfo(
  tree: Tree,
  component: 'app' | 'nx-welcome',
  componentFileSuffix: string,
  project: ProjectConfiguration
): ComponentMetadata {
  let componentPath = joinPathFragments(
    project.sourceRoot,
    `app/${component}.component.ts`
  );

  if (!tree.exists(componentPath)) {
    componentPath = joinPathFragments(
      project.sourceRoot,
      `app/${component}.ts`
    );
  }

  if (!tree.exists(componentPath)) {
    if (componentFileSuffix) {
      componentPath = joinPathFragments(
        project.sourceRoot,
        `app/${component}${componentFileSuffix}.ts`
      );
    }
  }

  if (!tree.exists(componentPath)) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    componentPath = joinPathFragments(
      project.sourceRoot,
      angularMajorVersion >= 20
        ? `app/${component}.ts`
        : `app/${component}.component.ts`
    );
  }

  const fileName = basename(componentPath);
  const extensionlessFileName = fileName.slice(0, -3);

  return {
    fileName,
    extensionlessFileName,
    path: componentPath,
    symbolName: names(extensionlessFileName).className,
  };
}
