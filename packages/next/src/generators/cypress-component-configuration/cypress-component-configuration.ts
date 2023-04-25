import {
  ensurePackage,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { isComponent } from '@nx/react/src/utils/ct-utils';
import { CypressComponentConfigurationGeneratorSchema } from './schema';
import { nxVersion } from '../../utils/versions';
import { componentTestGenerator } from '@nx/react';
import { normalize, relative } from 'path';

export async function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigurationGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { cypressComponentProject } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);
  tasks.push(
    await cypressComponentProject(tree, {
      project: options.project,
      skipFormat: true,
    })
  );
  const projectConfig = readProjectConfiguration(tree, options.project);

  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    skipServe: true,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);

  await addFiles(tree, projectConfig, options);

  const { webpackInitGenerator } = ensurePackage<typeof import('@nx/webpack')>(
    '@nx/webpack',
    nxVersion
  );
  tasks.push(
    await webpackInitGenerator(tree, {
      compiler: 'swc',
      uiFramework: 'react',
      skipFormat: true,
    })
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  opts: CypressComponentConfigurationGeneratorSchema
) {
  const cypressConfigPath = joinPathFragments(
    projectConfig.root,
    'cypress.config.ts'
  );
  if (tree.exists(cypressConfigPath)) {
    tree.delete(cypressConfigPath);
  }

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectConfig.root,
    {
      tailwind: ['js', 'cjs'].some((ext) =>
        tree.exists(
          joinPathFragments(projectConfig.root, `tailwind.config.${ext}`)
        )
      ),
      tpl: '',
    }
  );

  const ctFile = joinPathFragments(
    projectConfig.root,
    'cypress',
    'support',
    'component.ts'
  );

  tree.write(ctFile, `${tree.read(ctFile, 'utf-8')}import './styles.ct.css';`);

  if (opts.generateTests) {
    const filePaths = [];
    visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
      const fromProjectRootPath = relative(projectConfig.root, filePath);
      console.log({ fromProjectRootPath, filePath });
      // we don't generate tests for pages/server-side/appDir components
      if (
        fromProjectRootPath.includes('pages') ||
        fromProjectRootPath.includes('server') ||
        fromProjectRootPath.includes('app')
      ) {
        return;
      }

      if (isComponent(tree, filePath)) {
        filePaths.push(filePath);
      }
    });

    for (const filePath of filePaths) {
      await componentTestGenerator(tree, {
        project: opts.project,
        componentPath: filePath,
      });
    }
  }
}

export default cypressComponentConfiguration;
