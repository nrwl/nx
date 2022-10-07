import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  getProjects,
  readWorkspaceConfiguration,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import { joinPathFragments } from '../../utils/path';

const skippedFiles = [
  'package.json', // Not to be added to filesets
  'babel.config.json', // Will be handled by various plugins
  'karma.conf.js', // Will be handled by @nrwl/angular
  'jest.preset.js', // Will be handled by @nrwl/jest
  '.storybook', // Will be handled by @nrwl/storybook
  // Will be handled by @nrwl/linter
  '.eslintrc.json',
  '.eslintrc.js',
];

export default async function (tree: Tree) {
  // If the workspace doesn't have a nx.json, don't make any changes
  if (!tree.exists('nx.json')) {
    return;
  }

  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  // If this is a npm workspace, don't make any changes
  if (workspaceConfiguration.extends === 'nx/presets/npm.json') {
    return;
  }

  workspaceConfiguration.namedInputs ??= {
    default: ['{projectRoot}/**/*', 'sharedGlobals'],
    sharedGlobals: [],
    production: ['default'],
  };

  if (isBuildATarget(tree)) {
    workspaceConfiguration.targetDefaults ??= {};
    workspaceConfiguration.targetDefaults.build ??= {};
    workspaceConfiguration.targetDefaults.build.inputs ??= [
      'production',
      '^production',
    ];
  }

  if (workspaceConfiguration.implicitDependencies) {
    const projects = getProjects(tree);

    for (const [files, dependents] of Object.entries(
      workspaceConfiguration.implicitDependencies
    )) {
      // Skip these because other plugins take care of them
      if (skippedFiles.includes(files)) {
        continue;
      } else if (Array.isArray(dependents)) {
        workspaceConfiguration.namedInputs.projectSpecificFiles = [];
        const defaultFileset = new Set(
          workspaceConfiguration.namedInputs.default ?? [
            '{projectRoot}/**/*',
            'sharedGlobals',
          ]
        );
        defaultFileset.add('projectSpecificFiles');
        workspaceConfiguration.namedInputs.default = Array.from(defaultFileset);

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
          updateProjectConfiguration(tree, dependent, project);
        }
      } else {
        workspaceConfiguration.namedInputs.sharedGlobals.push(
          joinPathFragments('{workspaceRoot}', files)
        );
      }
    }
    delete workspaceConfiguration.implicitDependencies;
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

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
