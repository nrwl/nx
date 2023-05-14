import {
  ensurePackage,
  formatFiles,
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
import { relative } from 'path';

export async function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigurationGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { cypressComponentConfiguration: baseCyCtConfig } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);
  tasks.push(
    await baseCyCtConfig(tree, {
      project: options.project,
      skipFormat: true,
    })
  );

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

  const projectConfig = readProjectConfiguration(tree, options.project);

  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    skipServe: true,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);

  await addFiles(tree, projectConfig, options);

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
  const { addMountDefinition, addDefaultCTConfig } = await import(
    '@nx/cypress/src/utils/config'
  );

  const ctFile = joinPathFragments(
    projectConfig.root,
    'cypress',
    'support',
    'component.ts'
  );

  const updatedCommandFile = await addMountDefinition(
    tree.read(ctFile, 'utf-8')
  );
  tree.write(
    ctFile,
    `import { mount } from 'cypress/react18';\nimport './styles.ct.css';\n${updatedCommandFile}`
  );

  const cyFile = joinPathFragments(projectConfig.root, 'cypress.config.ts');
  const updatedCyConfig = await addDefaultCTConfig(tree.read(cyFile, 'utf-8'));
  tree.write(
    cyFile,
    `import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';\n${updatedCyConfig}`
  );

  const isUsingTailwind = ['js', 'cjs'].some((ext) =>
    tree.exists(joinPathFragments(projectConfig.root, `tailwind.config.${ext}`))
  );

  tree.write(
    joinPathFragments(
      projectConfig.root,
      'cypress',
      'support',
      'styles.ct.css'
    ),
    `/* This is where you can load global styles to apply to all components. */
${
  isUsingTailwind
    ? `@tailwind base;
@tailwind components;
@tailwind utilities;`
    : ''
}
`
  );

  if (opts.generateTests) {
    const filePaths = [];
    visitNotIgnoredFiles(tree, projectConfig.sourceRoot, (filePath) => {
      const fromProjectRootPath = relative(projectConfig.root, filePath);
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
