import {
  names,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { getNewProjectName } from '@nrwl/workspace/src/generators/move/lib/utils';
import { Schema } from '../schema';

/**
 * Updates the Angular module name (including the spec file and index.ts)
 *
 * Again, if the user has deviated from the expected folder
 * structure, they are very much on their own.
 *
 * @param schema The options provided to the schematic
 */
export async function updateModuleName(
  tree: Tree,
  { projectName, destination }: Schema
) {
  const newProjectName = getNewProjectName(destination);

  const project = readProjectConfiguration(tree, newProjectName);

  if (project.projectType === 'application') {
    // Expect the module to be something like 'app.module.ts' regardless of the folder name,
    // Therefore, nothing to do.
    return tree;
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

  const filesToChange = [
    {
      from: `${project.sourceRoot}/lib/${moduleFile.from}.ts`,
      to: `${project.sourceRoot}/lib/${moduleFile.to}.ts`,
    },
    {
      from: `${project.sourceRoot}/lib/${moduleFile.from}.spec.ts`,
      to: `${project.sourceRoot}/lib/${moduleFile.to}.spec.ts`,
    },
  ];

  // Update the module file and its spec file
  filesToChange.forEach((file) => {
    if (tree.exists(file.from)) {
      let content = tree.read(file.from)?.toString('utf-8');

      if (content) {
        if (findModuleName.test(content)) {
          content = content.replace(findModuleName, moduleName.to);
        }

        if (findFileName.test(content)) {
          content = content.replace(findFileName, moduleFile.to);
        }

        tree.write(file.to, content);
      }

      tree.delete(file.from);
    }
  });

  const skipFiles = filesToChange.map((file) => file.from);

  // Update any files which import the module
  visitNotIgnoredFiles(tree, '', (file) => {
    // skip files that were already modified
    if (skipFiles.includes(file)) {
      return;
    }

    let content = tree.read(file)?.toString();

    if (content) {
      if (findModuleName.test(content)) {
        content = content.replace(findModuleName, moduleName.to);
      }

      if (findFileName.test(content)) {
        content = content.replace(findFileName, moduleFile.to);
      }
      tree.write(file, content);
    }
  });
}
