import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  output,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
// nx-ignore-next-line
import * as path from 'path';
import {
  GeneratorsJson,
  GeneratorsJsonEntry,
} from 'nx/src/config/misc-interfaces';
import { moveGenerator } from '../../generators/move/move';
import { nxVersion } from '../../utils/versions';
import { PackageJson } from 'nx/src/utils/package-json';

const PROJECT_NAME = 'workspace-plugin';
const DESTINATION = `tools/${PROJECT_NAME}`;

export default async function (tree: Tree) {
  const tasks = [];
  if (!tree.children('tools/generators').length) {
    return;
  }

  let project = getProjects(tree).get(PROJECT_NAME);
  if (!project) {
    await createNewPlugin(tree);
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/plugin': nxVersion,
        }
      )
    );
    project = readProjectConfiguration(tree, PROJECT_NAME);
  }
  await updateExistingPlugin(tree, project);
  await formatFiles(tree);
  return () => {
    for (const task of tasks) {
      task();
    }
  };
}

// Inspired by packages/nx/src/command-line/workspace-generators.ts
function collectAndMoveGenerators(tree: Tree, destinationProjectRoot: string) {
  const generators: Record<string, GeneratorsJsonEntry> = {};
  const generatorsDir = 'tools/generators';
  const destinationDir = joinPathFragments(
    destinationProjectRoot,
    'src',
    'generators'
  );
  for (const c of tree.children('tools/generators')) {
    const childDir = path.join(generatorsDir, c);
    const schemaPath = joinPathFragments(childDir, 'schema.json');
    if (tree.exists(schemaPath)) {
      const schema = readJson(tree, schemaPath);
      generators[c] = {
        implementation: `./src/generators/${c}`,
        schema: `./src/generators/${joinPathFragments(c, 'schema.json')}`,
        description: schema.description ?? `Generator ${c}`,
      };
      tree.rename(childDir, joinPathFragments(destinationDir, c));
    }
  }
  return generators;
}

async function createNewPlugin(tree: Tree) {
  ensurePackage('@nx/plugin', nxVersion);
  const { pluginGenerator } =
    // nx-ignore-next-line
    require('@nx/plugin/src/generators/plugin/plugin');

  // nx-ignore-next-line
  const { Linter } = ensurePackage('@nx/linter', nxVersion);

  const { npmScope } = getWorkspaceLayout(tree);
  const importPath = npmScope ? `${npmScope}/${PROJECT_NAME}` : PROJECT_NAME;

  await pluginGenerator(tree, {
    minimal: true,
    name: PROJECT_NAME,
    importPath: importPath,
    skipTsConfig: false,
    compiler: 'tsc',
    linter: Linter.EsLint,
    skipFormat: true,
    skipLintChecks: false,
    unitTestRunner: 'jest',
    e2eTestRunner: 'none',
  });
  getCreateGeneratorsJson()(
    tree,
    readProjectConfiguration(tree, PROJECT_NAME).root,
    PROJECT_NAME
  );
  await moveGeneratedPlugin(tree, DESTINATION, importPath);
}

function moveGeneratedPlugin(
  tree: Tree,
  destination: string,
  importPath: string
) {
  const config = readProjectConfiguration(tree, PROJECT_NAME);
  if (config.root !== DESTINATION) {
    return moveGenerator(tree, {
      destination,
      projectName: PROJECT_NAME,
      newProjectName: PROJECT_NAME,
      updateImportPath: true,
      destinationRelativeToRoot: true,
      importPath: importPath,
    });
  }
}

function updateExistingPlugin(tree: Tree, project: ProjectConfiguration) {
  const packageJson = readJson<PackageJson>(
    tree,
    joinPathFragments(project.root, 'package.json')
  );
  const defaultGeneratorsPath = joinPathFragments(
    project.root,
    'generators.json'
  );
  let generatorsJsonPath =
    packageJson.generators ||
    packageJson.schematics ||
    tree.exists(defaultGeneratorsPath)
      ? defaultGeneratorsPath
      : null;
  if (!generatorsJsonPath) {
    getCreateGeneratorsJson()(
      tree,
      readProjectConfiguration(tree, PROJECT_NAME).root,
      PROJECT_NAME
    );
    generatorsJsonPath = defaultGeneratorsPath;
  }
  updateJson<GeneratorsJson>(tree, generatorsJsonPath, (json) => {
    const generators = collectAndMoveGenerators(tree, project.root);
    json.generators ??= {};
    for (const generator in generators) {
      if (json.generators[generator]) {
        output.warn({
          title: `Generator ${generator} already exists in ${project.name}`,
          bodyLines: [
            'Since you have a generator with the same name in your plugin, the generator from workspace-generators has been discarded.',
          ],
        });
      } else {
        json.generators[generator] = generators[generator];
      }
    }
    return json;
  });
}

function getCreateGeneratorsJson(): (
  host: Tree,
  projectRoot: string,
  projectName: string,
  skipLintChecks?: boolean,
  skipFormat?: boolean
) => Promise<void> {
  // We cant use  `as typeof import('@nx/plugin/src/generators/generator/generator');` here
  // because it will cause a typescript error at build time.
  const { createGeneratorsJson } =
    // nx-ignore-next-line
    require('@nx/plugin/src/generators/generator/generator');
  return createGeneratorsJson;
}
