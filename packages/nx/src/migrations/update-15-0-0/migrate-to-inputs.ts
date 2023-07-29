import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { joinPathFragments } from '../../utils/path';
import { join } from 'path';
import { updateJson } from '../../generators/utils/json';
import { PackageJson } from '../../utils/package-json';

const skippedFiles = [
  'package.json', // Not to be added to filesets
  'babel.config.json', // Will be handled by various plugins
  'karma.conf.js', // Will be handled by @nx/angular
  'jest.preset.js', // Will be handled by @nx/jest
  '.storybook', // Will be handled by @nx/storybook
  // Will be handled by @nx/linter
  '.eslintrc.json',
  '.eslintrc.js',
];

export default async function (tree: Tree) {
  // If the workspace doesn't have a nx.json, don't make any changes
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);

  // If this is a npm workspace, don't make any changes
  if (nxJson.extends === 'nx/presets/npm.json') {
    return;
  }

  nxJson.namedInputs ??= {
    default: ['{projectRoot}/**/*', 'sharedGlobals'],
    sharedGlobals: [],
    production: ['default'],
  };
  if (nxJson.namedInputs.default) {
    if (!nxJson.namedInputs.production) {
      nxJson.namedInputs.production = ['default'];
    } else if (!nxJson.namedInputs.production.includes('default')) {
      nxJson.namedInputs.production = [
        'default',
        ...nxJson.namedInputs.production,
      ];
    }
  }

  if (isBuildATarget(tree)) {
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults.build ??= {};
    nxJson.targetDefaults.build.inputs ??= ['production', '^production'];
  }

  if (nxJson.implicitDependencies) {
    const projects = getProjects(tree);

    for (const [files, dependents] of Object.entries(
      nxJson.implicitDependencies
    )) {
      // Skip these because other plugins take care of them
      if (skippedFiles.includes(files)) {
        continue;
      } else if (Array.isArray(dependents)) {
        nxJson.namedInputs.projectSpecificFiles = [];
        const defaultFileset = new Set(
          nxJson.namedInputs.default ?? ['{projectRoot}/**/*', 'sharedGlobals']
        );
        defaultFileset.add('projectSpecificFiles');
        nxJson.namedInputs.default = Array.from(defaultFileset);

        for (const dependent of dependents) {
          const project = projects.get(dependent);
          project.namedInputs ??= {};
          const projectSpecificFileset = new Set(
            project.namedInputs.projectSpecificFiles ?? []
          );
          projectSpecificFileset.add(
            joinPathFragments('{workspaceRoot}', files)
          );
          project.namedInputs.projectSpecificFiles = Array.from(
            projectSpecificFileset
          );

          try {
            updateProjectConfiguration(tree, dependent, project);
          } catch {
            if (tree.exists(join(project.root, 'package.json'))) {
              updateJson<PackageJson>(
                tree,
                join(project.root, 'package.json'),
                (json) => {
                  json.nx ??= {};
                  json.nx.namedInputs ??= {};
                  json.nx.namedInputs.projectSpecificFiles ??=
                    project.namedInputs.projectSpecificFiles;

                  return json;
                }
              );
            }
          }
        }
      } else {
        nxJson.namedInputs.sharedGlobals.push(
          joinPathFragments('{workspaceRoot}', files)
        );
      }
    }
    delete nxJson.implicitDependencies;
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function isBuildATarget(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, project] of projects) {
    if (project.targets?.build) {
      return true;
    }
  }

  return false;
}
