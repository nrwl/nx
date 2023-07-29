import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { findNodes } from '@nx/js';
import { normalizeViteConfigFilePathWithTree } from '../../utils/generator-utils';
import ts = require('typescript');

export async function removeProjectsFromViteTsConfigPaths(tree: Tree) {
  findAllProjectsWithViteConfig(tree);
  await formatFiles(tree);
}

export default removeProjectsFromViteTsConfigPaths;

function findAllProjectsWithViteConfig(tree: Tree): void {
  forEachExecutorOptions(tree, '@nrwl/vite:build', (options, project) => {
    const projectConfiguration = readProjectConfiguration(tree, project);
    const viteConfig = normalizeViteConfigFilePathWithTree(
      tree,
      projectConfiguration.root,
      options?.['configFile']
    );
    if (viteConfig) {
      const appFileContent = tree.read(viteConfig, 'utf-8');
      const file = tsquery.ast(appFileContent);
      let newContents = appFileContent;
      const defineConfig = tsquery.query(
        file,
        'CallExpression:has(Identifier[name="defineConfig"])'
      );
      let startOfProjects, endOfProjects;

      defineConfig?.[0]?.getChildren().forEach((defineConfigContentNode) => {
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
