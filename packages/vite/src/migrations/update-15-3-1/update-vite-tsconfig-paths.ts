import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
} from '@nrwl/devkit';

import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { findNodes } from 'nx/src/utils/typescript';
import ts = require('typescript');

export async function removeProjectsFromViteTsConfigPaths(tree: Tree) {
  findAllProjectsWithViteConfig(tree);
  await formatFiles(tree);
}

export default removeProjectsFromViteTsConfigPaths;

function findAllProjectsWithViteConfig(tree: Tree): void {
  forEachExecutorOptions(tree, '@nrwl/vite:build', (options, project) => {
    const projectConfiguration = readProjectConfiguration(tree, project);
    const viteConfig = normalizeConfigFilePathWithTree(
      tree,
      projectConfiguration.root,
      options?.['configFile'],
      workspaceRoot
    );
    if (viteConfig) {
      const file = getTsSourceFile(tree, viteConfig);
      const appFileContent = tree.read(viteConfig, 'utf-8');
      let newContents = appFileContent;
      const defineConfig = findNodes(file, [ts.SyntaxKind.CallExpression]);
      let startOfProjects, endOfProjects;
      defineConfig.forEach((node) => {
        if (node.getText().startsWith('defineConfig')) {
          node.getChildren().forEach((defineConfigContentNode) => {
            // Make sure it's the one we are looking for
            // We cannot assume that it's called tsConfigPaths
            // So make sure it includes `projects` and `root`
            if (
              defineConfigContentNode.getText().includes('projects') &&
              defineConfigContentNode.getText().includes('root')
            ) {
              findNodes(defineConfigContentNode, [
                ts.SyntaxKind.PropertyAssignment,
              ]).forEach((nodePA) => {
                if (nodePA.getText().startsWith('projects')) {
                  startOfProjects = nodePA.getStart();
                  endOfProjects = nodePA.getEnd();
                }
              });
            }
          });
        }
      });
      if (startOfProjects && endOfProjects) {
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Delete,
            start: startOfProjects,
            length: endOfProjects - startOfProjects + 1,
          },
        ]);
        tree.write(viteConfig, newContents);
      }
    }
  });
}

export function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return source;
}

function normalizeConfigFilePathWithTree(
  tree: Tree,
  projectRoot: string,
  configFile?: string,
  workspaceRoot?: string
): string {
  return configFile
    ? joinPathFragments(`${workspaceRoot}/${configFile}`)
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}
