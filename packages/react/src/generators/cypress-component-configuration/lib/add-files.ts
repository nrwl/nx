import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { nxVersion } from 'nx/src/utils/versions';
import { componentTestGenerator } from '../../component-test/component-test';
import type { CypressComponentConfigurationSchema } from '../schema';
import { getBundlerFromTarget, isComponent } from '../../../utils/ct-utils';
import { FoundTarget } from '@nx/cypress/src/utils/find-target-options';

export async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema,
  found: FoundTarget
) {
  // must dyanmicaly import to prevent packages not using cypress from erroring out
  // when importing react
  const { addMountDefinition, addDefaultCTConfig } = await import(
    '@nx/cypress/src/utils/config'
  );

  // Specifically undefined to allow Remix workaround of passing an empty string
  const actualBundler =
    options.buildTarget !== undefined && options.bundler
      ? options.bundler
      : await getBundlerFromTarget(found, tree);

  if (options.bundler && options.bundler !== actualBundler) {
    logger.warn(
      `You have specified ${options.bundler} as the bundler but this project is configured to use ${actualBundler}.
      This may cause errors. If you are seeing errors, try removing the --bundler option.`
    );
  }

  const bundlerToUse = options.bundler ?? actualBundler;

  const commandFile = joinPathFragments(
    projectConfig.root,
    'cypress',
    'support',
    'component.ts'
  );

  const updatedCommandFile = await addMountDefinition(
    tree.read(commandFile, 'utf-8')
  );
  tree.write(
    commandFile,
    `import { mount } from 'cypress/react18';\n${updatedCommandFile}`
  );
  const cyFile = joinPathFragments(projectConfig.root, 'cypress.config.ts');
  const updatedCyConfig = await addDefaultCTConfig(
    tree.read(cyFile, 'utf-8'),

    { bundler: bundlerToUse }
  );
  tree.write(
    cyFile,
    `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';\n${updatedCyConfig}`
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
