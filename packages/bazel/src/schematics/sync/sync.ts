import {
  apply,
  chain,
  MergeStrategy,
  mergeWith,
  move,
  Rule,
  schematic,
  Source,
  template,
  Tree,
  url,
  SchematicContext
} from '@angular-devkit/schematics';
import {
  getProjectGraphFromHost,
  getWorkspace,
  readJsonInTree,
  readWorkspace
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import {
  ProjectGraph,
  ProjectGraphNode
} from '@nrwl/workspace/src/core/project-graph';
import { rulesNodeJSSha, rulesNodeJSVersion } from '../utils/versions';
import { TargetDefinition } from '@angular-devkit/core/src/workspace';
import * as fs from 'fs';
import * as path from 'path';
import { fileSync } from 'tmp';
import { execSync } from 'child_process';

const buildBuilders = {
  '@angular-devkit/build-angular:browser': 'outputPath',
  '@angular-devkit/build-angular:server': 'outputPath',
  '@angular-devkit/build-angular:ng-packagr': 'outputPath',
  '@angular-devkit/build-webpack:webpack': 'outputPath',
  '@nrwl/web:build': 'outputPath'
};

const testBuilders = new Set([
  '@angular-devkit/build-angular:karma',
  '@angular-devkit/build-angular:protractor',
  '@angular-devkit/build-angular:tslint',
  '@nrwl/jest:jest',
  '@nrwl/cypress:cypress',
  '@nrwl/linter:lint'
]);

function getArchitectTargets(
  project: ProjectGraphNode,
  labelsMetadata: Array<{
    name: string;
    configurations: string[];
    target: TargetDefinition;
  }>
): {
  bazelRuleName: string;
  cliTarget: string;
  bazelLabel: string;
  isBuildTarget: boolean;
  outputArgument: string;
}[] {
  const labels: {
    bazelRuleName: string;
    cliTarget: string;
    bazelLabel: string;
    isBuildTarget: boolean;
    outputArgument: string;
  }[] = [];

  labelsMetadata.map(metadata =>
    metadata.configurations.map(config => {
      const isTestTarget = testBuilders.has(metadata.target.builder);
      const isBuildTarget = !!buildBuilders[metadata.target.builder];
      const outputArgument = buildBuilders[metadata.target.builder];
      return {
        bazelRuleName: isTestTarget ? 'nx_test' : 'nx',
        cliTarget: `${project.name}:${metadata.name}${
          config === '__nx_default__' ? '' : `:${config}`
        }`,
        bazelLabel: `${metadata.name}${
          config === '__nx_default__' ? '' : `__${config}`
        }`,
        isBuildTarget,
        outputArgument
      };
    })
  );

  return labels;
}

function updateBuildFile(
  project: ProjectGraphNode,
  projectGraph: ProjectGraph
): Rule {
  return async (host, context) => {
    const workspace = await getWorkspace(host);
    const labelsMetadata = Array.from(
      workspace.projects.get(project.name).targets.entries()
    ).map(([name, target]) => ({
      name,
      target,
      configurations: [
        '__nx_default__',
        ...Object.keys(target.configurations || {})
      ]
    }));
    const buildFilePath = join(normalize(project.data.root), 'BUILD.bazel');
    const bazelTargetPrefix = `//${path.posix.relative(
      host.root.path,
      buildFilePath
    )}`;
    const architectTargets = getArchitectTargets(project, labelsMetadata);

    function buildozerEdit(editStr, targetName) {
      return `${editStr}|${bazelTargetPrefix}:${targetName}`;
    }
    const edits = [
      buildozerEdit('new_load @npm//@nrwl/cli:index.bzl nx nx_test', '__pkg__')
    ];

    if (!host.exists(buildFilePath)) {
      fs.promises.writeFile(
        buildFilePath,
        `"""
BUILD file generated and maintained by NX.

NX produces one filegroup for every project and one build target per architect
definition in your associated with your project.

If you'd like to disable NX management of a specicic target, add the following
comment above that attribute: # User managed target
"""
`
      );

      const dependencies = projectGraph.dependencies[project.name]
        ? projectGraph.dependencies[project.name].map(
            dep =>
              `//${normalize(projectGraph.nodes[dep.target].data.root)}:${
                dep.target
              }`
          )
        : [];

      edits.push(
        buildozerEdit(`new filegroup ${project.name}`, project.name),
        buildozerEdit(`set srcs glob["**"]`, project.name),
        ...(dependencies
          ? buildozerEdit(`add srcs ${dependencies.join(' ')}`, project.name)
          : []),
        buildozerEdit(`set visibility //:__subpackages__`, project.name)
      );

      architectTargets.forEach(t => {
        edits.push(
          buildozerEdit(`new ${t.bazelRuleName} ${t.bazelLabel}`, '__pkg__'),
          buildozerEdit(
            `set args run ${t.cliTarget}${
              t.isBuildTarget ? ` --${t.outputArgument}=$(@D)` : ''
            }`,
            t.bazelLabel
          ),
          buildozerEdit(
            `set data :${project.name} //:root-files @npm//:node_modules`,
            t.bazelLabel
          )
        );
      });
    } else {
    }

    edits.push('fix unusedLoads');

    runBuildozer(edits);
    return;
  };
}

export function buildFileNeedsUpdate(
  project: ProjectGraphNode
): (tree: Tree, context: SchematicContext) => Promise<boolean> {
  return async (host, context) => {
    const workspace = await getWorkspace(host);
    const labelsMetadata = Array.from(
      workspace.projects.get(project.name).targets.entries()
    ).map(([name, target]) => ({
      name,
      target,
      configurations: [
        '__nx_default__',
        ...Object.keys(target.configurations || {})
      ]
    }));
    const buildFilePath = join(normalize(project.data.root), 'BUILD.bazel');
    const bazelTargetPrefix = `//${path.posix.relative(
      host.root.path,
      buildFilePath
    )}`;
    const architectTargets = getArchitectTargets(project, labelsMetadata);

    function buildozerCheck(editStr, targetName) {
      return `${editStr}|${bazelTargetPrefix}:${targetName}`;
    }

    const checksForSpecialComments = architectTargets.map(target =>
      buildozerCheck('print_comment', target.bazelLabel)
    );

    const targetsToCheck = runBuildozer(checksForSpecialComments)
      .split('\n')
      .map((comment, index) => ({ comment, target: architectTargets[index] }))
      .filter(({ comment }) => !comment.startsWith('User managed target'))
      .map(({ target }) => target);

    const attributeChecks = targetsToCheck.map(target =>
      buildozerCheck(
        `print args data ${target.isBuildTarget ? 'output_dir' : ''}`,
        target.bazelLabel
      )
    );

    const expectedOutput = targetsToCheck
      .map(target => {
        const expectedArgs = ['run', target.cliTarget];
        const expectedDataDeps = [
          ':cart',
          '//:root-files',
          '@npm//:node_modules'
        ];

        if (target.isBuildTarget) {
          expectedArgs.push('--outputPath=$(@D)');

          return `[] [] True`;
        }

        return `[${expectedArgs.join(' ')}] [${expectedDataDeps.join(' ')}]`;
      })
      .join('\n');

    return runBuildozer(attributeChecks) === expectedOutput;
  };
}

function runBuildozer(commands: string[], flags: string[] = []) {
  const tmpFile = fileSync();
  fs.promises.writeFile(tmpFile.name, commands.join('\n'));
  const out = execSync(
    `npx buildozer -f ${tmpFile.name} ${flags.join(' ')}`
  ).toString();
  tmpFile.removeCallback();
  return out;
}

function createWorkspaceFile() {
  return host => {
    return mergeWith(
      apply(url('./files/workspace-file'), [
        template({
          tmpl: '',
          name: readJsonInTree(host, '/package.json').name.replace('-', '_'),
          rulesNodeJSVersion,
          rulesNodeJSSha
        }),
        () => {
          if (host.exists('WORKSPACE')) {
            host.delete('WORKSPACE');
          }
        }
      ]),
      MergeStrategy.Overwrite
    );
  };
}

const ignoredFromRootBuildFile = ['WORKSPACE', '.bazelrc', 'BUILD.bazel'];

function createRootBuildFile() {
  return host => {
    return mergeWith(
      apply(url('./files/root-build-file'), [
        template({
          tmpl: '',
          rootFiles: host
            .getDir('/')
            .subfiles.filter(f => !ignoredFromRootBuildFile.includes(f))
        }),
        () => {
          if (host.exists('BUILD.bazel')) {
            host.delete('BUILD.bazel');
          }
        }
      ]),
      MergeStrategy.Overwrite
    );
  };
}

const runInit = schematic<{}>('init', {});

export default (): Rule => {
  return (host: Tree) => {
    const projectGraph = getProjectGraphFromHost(host);

    return chain([
      runInit,
      createWorkspaceFile(),
      createRootBuildFile(),
      ...Object.values(projectGraph.nodes).map(project =>
        updateBuildFile(project, projectGraph)
      )
    ]);
  };
};
