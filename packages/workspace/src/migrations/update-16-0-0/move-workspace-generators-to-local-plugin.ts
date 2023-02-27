import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
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
          '@nrwl/nx-plugin': nxVersion,
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
  ensurePackage('@nrwl/nx-plugin', nxVersion);
  const { pluginGenerator } =
    // nx-ignore-next-line
    require('@nrwl/nx-plugin/src/generators/plugin/plugin');
  const { createExecutorsJson } =
    // nx-ignore-next-line
    require('@nrwl/nx-plugin/src/generators/executor/executor');
  const { createGeneratorsJson } =
    // nx-ignore-next-line
    require('@nrwl/nx-plugin/src/generators/generator/generator');

  // nx-ignore-next-line
  const { Linter } = ensurePackage('@nrwl/linter', nxVersion);

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
  createExecutorsJson(tree, readProjectConfiguration(tree, PROJECT_NAME).root);
  createGeneratorsJson(tree, readProjectConfiguration(tree, PROJECT_NAME).root);
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
  const generatorsJsonPath =
    packageJson.generators ||
    packageJson.schematics ||
    tree.exists(defaultGeneratorsPath)
      ? defaultGeneratorsPath
      : null;
  if (!generatorsJsonPath) {
    throw new Error('Unable to locate generators.json for ' + project.name);
  }
  const generatorsJson = readJson<GeneratorsJson>(tree, generatorsJsonPath);
  const generators = collectAndMoveGenerators(tree, project.root);
  generatorsJson.generators = {
    ...generators,
    ...generatorsJson.generators,
  };
  writeJson(tree, generatorsJsonPath, generatorsJson);
}
