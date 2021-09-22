import {
  addDependenciesToPackageJson,
  Tree,
  formatFiles,
  removeDependenciesFromPackageJson,
  readJson,
  getProjects,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { exec } from 'child_process';
import { join } from 'path';

import { gatsbyPluginImageVersion } from '../../utils/versions';

/**
 * For gatsby app, replace gatsby-image with gatsby-plugin-image.
 * It updates the package names in package.json.
 * It uses gatsby-codemods to update imports.
 * It also add gatsby-plugin-image to project app's package.json and gatsby-config.js.
 */
export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  // does not proceed if gatsby-image is not a part of devDependencies
  if (!packageJson.dependencies['gatsby-image']) {
    return;
  }

  const replacePackagesTasks = replaceInPackageJson(tree);
  const updateImportsTasks = updateImports(tree);
  updateAppPackageJson(tree);
  await formatFiles(tree);
  return runTasksInSerial(...replacePackagesTasks, ...updateImportsTasks);
}

function replaceInPackageJson(tree: Tree) {
  const uninstallTask = removeDependenciesFromPackageJson(
    tree,
    ['gatsby-image'],
    []
  );
  const installTask = addDependenciesToPackageJson(
    tree,
    { 'gatsby-plugin-image': gatsbyPluginImageVersion },
    {}
  );

  return [uninstallTask, installTask];
}

function updateImports(tree: Tree) {
  const projects = getProjects(tree);
  const tasks = [];
  const replaceProjectRef = new RegExp('gatsby-image', 'g');
  for (const [name, definition] of Array.from(projects.entries())) {
    visitNotIgnoredFiles(tree, definition.root, (file) => {
      const contents = tree.read(file, 'utf-8');
      if (!replaceProjectRef.test(contents)) {
        return;
      }
      tasks.push(runGatsbyCodemods(file, tree));
    });
  }
  return tasks;
}

/**
 * Run gatsby-codemods to transform file with import gatsby-image to use gatsby-plugin-image
 * https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-codemods/src/transforms/gatsby-plugin-image.js
 */
async function runGatsbyCodemods(file: string, tree: Tree) {
  return new Promise<void>((resolve, reject) => {
    const childProcess = exec(
      require.resolve('gatsby-codemods/bin/gatsby-codemods.js') +
        ' gatsby-plugin-image ' +
        file,
      {
        cwd: join(tree.root),
      }
    );

    childProcess.on('error', (err) => {
      reject(err);
      childProcess.kill();
    });

    childProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            'Could not migrate to gatsby-plugin-image. See errors above.'
          )
        );
      } else {
        resolve();
      }
      childProcess.kill();
    });
  });
}

function updateAppPackageJson(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.build?.executor !== '@nrwl/gatsby:build') return;

    const appPackageJsonPath = `${project.root}/package.json`;
    if (tree.exists(appPackageJsonPath)) {
      addDependenciesToPackageJson(
        tree,
        { 'gatsby-plugin-image': '*' },
        {},
        appPackageJsonPath
      );
    }

    const gatsbyConfigPath = `${project.root}/gatsby-config.js`;
    if (tree.exists(gatsbyConfigPath)) {
      const contents = tree.read(gatsbyConfigPath, 'utf-8');
      const gatsbyPluginImageRegex = new RegExp('gatsby-plugin-image', 'g');
      if (gatsbyPluginImageRegex.test(contents)) {
        return;
      }
      tree.write(
        gatsbyConfigPath,
        contents.replace(
          `\`gatsby-transformer-sharp\``,
          `\`gatsby-plugin-image\`, \`gatsby-transformer-sharp\``
        )
      );
    }
  });
}
