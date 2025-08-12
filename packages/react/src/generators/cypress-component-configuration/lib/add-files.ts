import type { FoundTarget } from '@nx/cypress/src/utils/find-target-options';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { nxVersion } from 'nx/src/utils/versions';
import { getActualBundler, isComponent } from '../../../utils/ct-utils';
import { componentTestGenerator } from '../../component-test/component-test';
import type { CypressComponentConfigurationSchema } from '../schema';

export async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigurationSchema,
  found: FoundTarget
) {
  // must dynamicaly import to prevent packages not using cypress from erroring out
  // when importing react
  const { addMountDefinition } = await import('@nx/cypress/src/utils/config');
  const { getInstalledCypressMajorVersion } = await import(
    '@nx/cypress/src/utils/versions'
  );
  const installedCypressMajorVersion = getInstalledCypressMajorVersion(tree);

  // Specifically undefined to allow Remix workaround of passing an empty string
  const actualBundler = await getActualBundler(tree, options, found);

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
