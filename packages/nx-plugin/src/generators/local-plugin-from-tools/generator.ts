import {
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import pluginGenerator from '../plugin/plugin';
import * as path from 'path';
import { LocalPluginFromToolsGeneratorSchema } from './schema';
import { Linter } from '@nrwl/linter';
import { GeneratorsJsonEntry } from 'nx/src/config/misc-interfaces';
import { moveGenerator } from '@nx/workspace';

function normalizeOptions(
  tree: Tree,
  schema: Partial<LocalPluginFromToolsGeneratorSchema>
): LocalPluginFromToolsGeneratorSchema {
  const { npmScope } = getWorkspaceLayout(tree);
  const pluginName = schema.pluginName ?? 'workspace-plugin';

  return {
    importPath: schema.importPath ?? `@${npmScope}/${pluginName}`,
    pluginName,
    toolsProjectRoot:
      schema.toolsProjectRoot ?? joinPathFragments('tools', pluginName),
  };
}

function addFiles(
  tree: Tree,
  options: LocalPluginFromToolsGeneratorSchema,
  generators: (GeneratorsJsonEntry & { name: string })[]
) {
  const templateOptions = {
    ...options,
    generators,
    tmpl: '',
  };
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    options.toolsProjectRoot,
    templateOptions
  );
}

export default async function (
  tree: Tree,
  options: Partial<LocalPluginFromToolsGeneratorSchema>
) {
  const normalizedOptions = normalizeOptions(tree, options);
  await pluginGenerator(tree, {
    minimal: true,
    name: normalizedOptions.pluginName,
    importPath: normalizedOptions.importPath,
    skipTsConfig: false,
    compiler: 'tsc',
    linter: Linter.EsLint,
    skipFormat: true,
    skipLintChecks: false,
    unitTestRunner: 'jest',
  });
  await moveGeneratedPlugin(tree, normalizedOptions);
  addFiles(
    tree,
    normalizedOptions,
    collectAndMoveGenerators(tree, normalizedOptions)
  );
  await formatFiles(tree);
}

// Inspired by packages/nx/src/command-line/workspace-generators.ts
function collectAndMoveGenerators(
  tree: Tree,
  options: LocalPluginFromToolsGeneratorSchema
) {
  const generators: ({
    name: string;
  } & GeneratorsJsonEntry)[] = [];
  const generatorsDir = 'tools/generators';
  const destinationDir = joinPathFragments(
    readProjectConfiguration(tree, options.pluginName).root,
    'src',
    'generators'
  );
  for (const c of tree.children('tools/generators')) {
    const childDir = path.join(generatorsDir, c);
    const schemaPath = joinPathFragments(childDir, 'schema.json');
    if (tree.exists(schemaPath)) {
      const schema = readJson(tree, schemaPath);
      generators.push({
        name: c,
        implementation: `./src/generators/${c}`,
        schema: `./src/generators/${joinPathFragments(c, 'schema.json')}`,
        description: schema.description ?? `Generator ${c}`,
      });
      moveFolder(tree, childDir, joinPathFragments(destinationDir, c));
    }
  }
  return generators;
}

function moveFolder(tree: Tree, source: string, destination: string) {
  for (const child of tree.children(source)) {
    const existingPath = joinPathFragments(source, child);
    const newPath = joinPathFragments(destination, child);
    if (tree.isFile(existingPath)) {
      tree.write(newPath, tree.read(existingPath));
      tree.delete(existingPath);
    } else {
      moveFolder(tree, existingPath, newPath);
    }
  }
  tree.delete(source);
}

function moveGeneratedPlugin(
  tree: Tree,
  options: LocalPluginFromToolsGeneratorSchema
) {
  const config = readProjectConfiguration(tree, options.pluginName);
  if (config.root !== options.toolsProjectRoot) {
    return moveGenerator(tree, {
      destination: options.toolsProjectRoot,
      projectName: options.pluginName,
      newProjectName: options.pluginName,
      updateImportPath: true,
      destinationRelativeToRoot: true,
      importPath: options.importPath,
    });
  }
}
