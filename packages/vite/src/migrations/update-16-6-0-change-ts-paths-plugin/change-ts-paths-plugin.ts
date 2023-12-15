import { Tree, getProjects, joinPathFragments } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { ViteBuildExecutorOptions } from '../../executors/build/schema';
import { tsquery } from '@phenomnomnominal/tsquery';

export default function update(tree: Tree) {
  const projects = getProjects(tree);
  forEachExecutorOptions<ViteBuildExecutorOptions>(
    tree,
    '@nx/vite:build',
    (options, projectName) => {
      const projectConfig = projects.get(projectName);
      const config =
        options.configFile || findViteConfig(tree, projectConfig.root);
      if (!config || !tree.exists(config)) {
        return;
      }

      const configContents = tree.read(config, 'utf-8');

      const oldTsConfigPathPlugin =
        tsquery.query(
          configContents,
          'ImportDeclaration:has(StringLiteral[value="vite-tsconfig-paths"])'
        ) ?? [];

      if (oldTsConfigPathPlugin.length === 0) {
        return;
      }

      const importName =
        oldTsConfigPathPlugin[0]?.['importClause']?.name?.text ??
        'viteTsConfigPaths';
      const updatedContent = tsquery.replace(
        configContents,
        `PropertyAssignment:has(Identifier[name="plugins"]) CallExpression:has(Identifier[name="${importName}"])`,
        () => {
          return `nxViteTsPaths()`;
        }
      );

      const withImportChange = tsquery.replace(
        updatedContent,
        'ImportDeclaration:has(StringLiteral[value="vite-tsconfig-paths"])',
        () => {
          return "import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';";
        }
      );

      tree.write(config, withImportChange);
    }
  );
}

function findViteConfig(tree: Tree, searchRoot: string) {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(joinPathFragments(searchRoot, `vite.config.${ext}`))) {
      return joinPathFragments(searchRoot, `vite.config.${ext}`);
    }
  }
}
