import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/internal';
import { isComponent } from '../../../utils/ct-utils';
import { componentTestGenerator } from '../../component-test/component-test';
import type { CypressComponentConfigurationSchema } from '../schema';
import { nxVersion } from '@nx/devkit/internal';

export async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema,
  buildBundler: 'vite' | 'webpack'
) {
  // must dynamicaly import to prevent packages not using cypress from erroring out
  // when importing react
  const {
    addMountDefinition,
    getInstalledCypressMajorVersion,
  }: typeof import('@nx/cypress/internal') = require('@nx/cypress/internal');
  const installedCypressMajorVersion = getInstalledCypressMajorVersion(tree);

  const actualBundler =
    options.buildTarget !== undefined && options.bundler
      ? options.bundler
      : buildBundler;

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
  const moduleSpecifier =
    installedCypressMajorVersion >= 14 ? 'cypress/react' : 'cypress/react18';
  tree.write(
    commandFile,
    `import { mount } from '${moduleSpecifier}';\n${updatedCommandFile}`
  );

  if (
    options.bundler === 'webpack' ||
    (!options.bundler && actualBundler === 'webpack')
  ) {
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/webpack': nxVersion },
      undefined,
      true
    );
  }

  if (
    options.bundler === 'vite' ||
    (!options.bundler && actualBundler === 'vite')
  ) {
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/vite': nxVersion },
      undefined,
      true
    );
  }

  if (options.generateTests) {
    const filePaths = [];
    const sourceRoot = getProjectSourceRoot(projectConfig, tree);
    visitNotIgnoredFiles(tree, sourceRoot, (filePath) => {
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
