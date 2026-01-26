import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import ignore = require('ignore');
import { nxVersion } from '../../utils/versions';
import { InitGeneratorSchema } from './schema';
import { hasDotNetPlugin } from '../../utils/has-dotnet-plugin';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!options.skipPackageJson && tree.exists('package.json')) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/dotnet': nxVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  addPlugin(tree);
  updateNxJsonConfiguration(tree);
  updateGitIgnore(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export function updateGitIgnore(tree: Tree) {
  const gitignorePath = '.gitignore';
  if (tree.exists(gitignorePath)) {
    let gitignore = tree.read(gitignorePath, 'utf-8');
    const sectionHeader = '# .NET';
    const potentialLinesToAdd = new Set(['**/bin/', '**/obj/', '/artifacts/']);

    if (gitignore.includes(sectionHeader)) {
      // Section already exists, do not modify
      return;
    }

    // Line with issues -> files that would have been ignored.
    const issues = new Map<string, string[]>();

    visitNotIgnoredFiles(tree, '.', (filePath) => {
      for (const line of potentialLinesToAdd) {
        const ig = ignore();
        ig.add(line);
        if (ig.ignores(filePath)) {
          if (!issues.has(line)) {
            issues.set(line, []);
          }
          issues.get(line)!.push(filePath);
        }
      }
    });
    let hasIssues = issues.size > 0;
    if (hasIssues) {
      logger.warn(
        `The following .gitignore entries cannot be added because they would ignore existing files:`
      );
    }
    for (const [line, files] of issues) {
      potentialLinesToAdd.delete(line);
      logger.warn(
        `- "${line}" would ignore the following existing files:\n` +
          files.map((f) => `  - ${f}`).join('\n')
      );
    }
    if (hasIssues) {
      logger.warn(
        `Review the above patterns and manually update your .gitignore as necessary.`
      );
    }
    if (potentialLinesToAdd.size > 0) {
      gitignore += `\n${sectionHeader}\n`;
      for (const line of potentialLinesToAdd) {
        gitignore += `${line}\n`;
      }
      tree.write(gitignorePath, gitignore);
    }
  }
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!hasDotNetPlugin(tree)) {
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/dotnet');
    updateNxJson(tree, nxJson);
  }
}

export function updateNxJsonConfiguration(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    nxJson.namedInputs = {};
  }

  // Default inputs include all project files
  const defaultFilesSet = nxJson.namedInputs.default ?? [];
  nxJson.namedInputs.default = Array.from(
    new Set([...defaultFilesSet, '{projectRoot}/**/*'])
  );

  // Production inputs exclude test files and build outputs
  const productionFileSet = nxJson.namedInputs.production ?? [];
  nxJson.namedInputs.production = Array.from(
    new Set([
      ...productionFileSet,
      'default',
      '!{projectRoot}/**/*.Tests/**/*',
      '!{projectRoot}/**/bin/**/*',
      '!{projectRoot}/**/obj/**/*',
    ])
  );

  updateNxJson(tree, nxJson);
}

export default initGenerator;
