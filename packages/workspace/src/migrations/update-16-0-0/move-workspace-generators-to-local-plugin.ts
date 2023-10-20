import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  getProjects,
  joinPathFragments,
  output,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
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
import { posix } from 'path';
import { getNpmScope } from '../../utilities/get-import-path';

const PROJECT_NAME = 'workspace-plugin';
const DESTINATION = `tools/${PROJECT_NAME}`;

export default async function (tree: Tree) {
  if (!tree.exists('tools/generators')) {
    return;
  }
  const tasks = [];
  if (hasWorkspaceGenerators(tree)) {
    tasks.push(...(await moveWorkspaceGeneratorsToLocalPlugin(tree)));
  }
  removeToolsGeneratorsIfEmpty(tree);
  await formatFiles(tree);
  return () => {
    for (const task of tasks) {
      task();
    }
  };
}

async function moveWorkspaceGeneratorsToLocalPlugin(tree: Tree) {
  const tasks = [];
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
  updateExistingPlugin(tree, project);
  return tasks;
}

function hasWorkspaceGenerators(tree: Tree) {
  const children = tree.children('tools/generators');
  return (
    children.length > 0 &&
    !(children.length === 1 && children[0] === '.gitkeep')
  );
}

function removeToolsGeneratorsIfEmpty(tree: Tree) {
  if (!hasWorkspaceGenerators(tree)) {
    tree.delete('tools/generators');
  }
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
      moveFilesInDirectory(
        tree,
        childDir,
        joinPathFragments(destinationDir, c)
      );
    }
  }
  return generators;
}

function moveFilesInDirectory(tree: Tree, source: string, destination: string) {
  const relative = posix.relative(source, posix.dirname(destination));
  if (!relative.startsWith('../')) {
    // If the destination is in the same directory or a subdirectory of the source
    // we can just move the files. If it is not, we need to update the relative imports.
    return;
  }
  let offsetLevel = 0;
  const pathParts = relative.split('/');
  for (const part of pathParts) {
    if (part === '..') {
      offsetLevel++;
    } else {
      break;
    }
  }
  for (const c of tree.children(source)) {
    if (!tree.isFile(c)) {
      moveFilesInDirectory(
        tree,
        joinPathFragments(source, c),
        joinPathFragments(destination, c)
      );
    }
    tree.rename(
      joinPathFragments(source, c),
      joinPathFragments(destination, c)
    );
    // If its a TS file we can update relative imports with find + replace
    // This could be done with AST, but since we are only looking at relative
    // imports its easy to do via string replace. We replace any strings starting
    // with a relative path outside of their own directory.
    if (c.endsWith('.ts')) {
      let content = tree.read(joinPathFragments(destination, c)).toString();
      // +2 is a bit of a magic number here - represents extra directory levels in a normal
      // plugin structure compared to the workspace-generator layout
      const extraDirectoriesInPluginStructure = 2;
      content = content.replace(
        new RegExp(`'` + `\.\.\/`.repeat(offsetLevel), 'g'),
        "'" + '../'.repeat(offsetLevel + extraDirectoriesInPluginStructure)
      );
      content = content.replace(
        new RegExp(`"` + `\.\.\/`.repeat(offsetLevel), 'g'),
        '"' + '../'.repeat(offsetLevel + extraDirectoriesInPluginStructure)
      );
      // We write it back in the same spot, since it is moved as if it was a regular file after this
      tree.write(joinPathFragments(source, c), content);
    }
    tree.rename(
      joinPathFragments(source, c),
      joinPathFragments(destination, c)
    );
  }
}

async function createNewPlugin(tree: Tree) {
  ensurePackage('@nx/plugin', nxVersion);
  const { pluginGenerator } =
    // nx-ignore-next-line
    require('@nx/plugin/src/generators/plugin/plugin');

  // nx-ignore-next-line
  const { Linter } = ensurePackage('@nx/eslint', nxVersion);

  const npmScope = getNpmScope(tree);
  const importPath = npmScope ? `@${npmScope}/${PROJECT_NAME}` : PROJECT_NAME;

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
    publishable: false,
  });
  await getCreateGeneratorsJson()(
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
      importPath: importPath,
      projectNameAndRootFormat: 'as-provided',
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
