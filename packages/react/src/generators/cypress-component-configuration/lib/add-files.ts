import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { nxVersion } from 'nx/src/utils/versions';
import { componentTestGenerator } from '../../component-test/component-test';
import type { CypressComponentConfigurationSchema } from '../schema';
import {
  FoundTarget,
  getBundlerFromTarget,
  isComponent,
} from '../../../utils/ct-utils';

export async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema,
  found: FoundTarget
) {
  const cypressConfigPath = joinPathFragments(
    projectConfig.root,
    'cypress.config.ts'
  );
  if (tree.exists(cypressConfigPath)) {
    tree.delete(cypressConfigPath);
  }

  const actualBundler = await getBundlerFromTarget(found, tree);

  if (options.bundler && options.bundler !== actualBundler) {
    logger.warn(
      `You have specified ${options.bundler} as the bundler but this project is configured to use ${actualBundler}.
      This may cause errors. If you are seeing errors, try removing the --bundler option.`
    );
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    projectConfig.root,
    {
      tpl: '',
      bundler: options.bundler ?? actualBundler,
    }
  );

  if (
    options.bundler === 'webpack' ||
    (!options.bundler && actualBundler === 'webpack')
  ) {
    addDependenciesToPackageJson(tree, {}, { '@nx/webpack': nxVersion });
  }

  if (
    options.bundler === 'vite' ||
    (!options.bundler && actualBundler === 'vite')
  ) {
    addDependenciesToPackageJson(tree, {}, { '@nx/vite': nxVersion });
  }

  if (options.generateTests) {
    const filePaths = [];
    visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
      if (isComponent(tree, filePath)) {
        filePaths.push(filePath);
      }
    });

    for (const filePath of filePaths) {
      await componentTestGenerator(tree, {
        project: options.project,
        componentPath: filePath,
      });
    }
  }
}
