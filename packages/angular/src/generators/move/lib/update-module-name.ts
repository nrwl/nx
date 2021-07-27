import {
  getProjects,
  names,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { getNewProjectName } from '@nrwl/workspace/src/generators/move/lib/utils';
import { join } from 'path';
import { Schema } from '../schema';

/**
 * Updates the Angular module name (including the spec file and index.ts)
 *
 * Again, if the user has deviated from the expected folder
 * structure, they are very much on their own.
 *
 * @param schema The options provided to the schematic
 */
export function updateModuleName(
  tree: Tree,
  { projectName, destination }: Schema
): void {
  const newProjectName = getNewProjectName(destination);

  const project = readProjectConfiguration(tree, newProjectName);

  if (project.projectType === 'application') {
    // Expect the module to be something like 'app.module.ts' regardless of the folder name,
    // Therefore, nothing to do.
    return;
  }

  const moduleName = {
    from: names(projectName).className,
    to: names(newProjectName).className,
  };

  const findModuleName = new RegExp(`\\b${moduleName.from}`, 'g');

  const moduleFile = {
    from: `${projectName}.module`,
    to: `${newProjectName}.module`,
  };

  const findFileName = new RegExp(`\\b${moduleFile.from}`, 'g');

  const filesToRename = [
    {
      from: `${project.sourceRoot}/lib/${moduleFile.from}.ts`,
      to: `${project.sourceRoot}/lib/${moduleFile.to}.ts`,
    },
    {
      from: `${project.sourceRoot}/lib/${moduleFile.from}.spec.ts`,
      to: `${project.sourceRoot}/lib/${moduleFile.to}.spec.ts`,
    },
  ].filter((rename) => rename.from !== rename.to);

  if (filesToRename.length === 0) {
    return;
  }

  const replacements = [
    {
      regex: findFileName,
      replaceWith: moduleFile.to,
    },
    {
      regex: findModuleName,
      replaceWith: moduleName.to,
    },
  ];

  // Update the module file and its spec file
  filesToRename.forEach((file) => {
    if (tree.exists(file.from)) {
      updateFileContent(tree, replacements, file.from, file.to);

      tree.delete(file.from);
    }
  });

  // update index file
  const indexFile = join(project.sourceRoot, 'index.ts');
  if (tree.exists(indexFile)) {
    updateFileContent(tree, replacements, indexFile);
  }

  const skipFiles = [...filesToRename.map((file) => file.to), indexFile];

  // Update any files which import the module
  for (const [, definition] of getProjects(tree)) {
    visitNotIgnoredFiles(tree, definition.root, (file) => {
      // skip files that were already modified

      if (skipFiles.includes(file)) {
        return;
      }

      updateFileContent(tree, replacements, file);
    });
  }
}

function updateFileContent(
  tree: Tree,
  replacements: { regex: RegExp; replaceWith: string }[],
  fileName: string,
  newFileName?: string
): void {
  let content = tree.read(fileName)?.toString('utf-8');

  if (content) {
    let updated = false;

    replacements.forEach((replacement) => {
      if (replacement.regex.test(content)) {
        content = content.replace(replacement.regex, replacement.replaceWith);
        updated = true;
      }
    });

    if (updated) {
      tree.write(newFileName ?? fileName, content);
    }
  }
}
