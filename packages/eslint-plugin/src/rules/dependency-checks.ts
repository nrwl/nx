import { AST } from 'jsonc-eslint-parser';
import { normalizePath, workspaceRoot } from '@nx/devkit';
import { createESLintRule } from '../utils/create-eslint-rule';
import { readProjectGraph } from '../utils/project-graph-utils';
import { findProject, getSourceFilePath } from '../utils/runtime-lint-utils';
import { join } from 'path';
import { findProjectsNpmDependencies } from '@nx/js/src/internal';
import { satisfies } from 'semver';
import { getHelperDependenciesFromProjectGraph } from '@nx/js';
import {
  getAllDependencies,
  removePackageJsonFromFileMap,
} from '../utils/package-json-utils';
import { JSONLiteral } from 'jsonc-eslint-parser/lib/parser/ast';

export type Options = [
  {
    buildTargets?: string[];
    checkMissingDependencies?: boolean;
    checkObsoleteDependencies?: boolean;
    checkVersionMismatches?: boolean;
    checkMissingPackageJson?: boolean;
    ignoredDependencies?: string[];
  }
];

export type MessageIds =
  | 'missingDependency'
  | 'obsoleteDependency'
  | 'versionMismatch'
  | 'missingDependencySection';

export const RULE_NAME = 'dependency-checks';

export default createESLintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Checks dependencies in project's package.json for version mismatches`,
      recommended: 'error',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          buildTargets: [{ type: 'string' }],
          ignoredDependencies: [{ type: 'string' }],
          checkMissingDependencies: { type: 'boolean' },
          checkObsoleteDependencies: { type: 'boolean' },
          checkVersionMismatches: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingDependency: `The "{{projectName}}" uses the following packages, but they are missing from the "{{section}}":{{packageNames}}`,
      obsoleteDependency: `The "{{packageName}}" package is not used by "{{projectName}}".`,
      versionMismatch: `The version specifier does not contain the installed version of "{{packageName}}" package: {{version}}.`,
      missingDependencySection: `Dependency sections are missing from the "package.json" but following dependencies were detected:{{dependencies}}`,
    },
  },
  defaultOptions: [
    {
      buildTargets: ['build'],
      checkMissingDependencies: true,
      checkObsoleteDependencies: true,
      checkVersionMismatches: true,
      ignoredDependencies: [],
    },
  ],
  create(
    context,
    [
      {
        buildTargets,
        ignoredDependencies,
        checkMissingDependencies,
        checkObsoleteDependencies,
        checkVersionMismatches,
      },
    ]
  ) {
    if (!(context.parserServices as any).isJSON) {
      return {};
    }
    const fileName = normalizePath(context.getFilename());
    // support only package.json
    if (!fileName.endsWith('/package.json')) {
      return {};
    }

    const projectPath = normalizePath(globalThis.projectPath || workspaceRoot);
    const sourceFilePath = getSourceFilePath(fileName, projectPath);
    const { projectGraph, projectRootMappings, projectFileMap } =
      readProjectGraph(RULE_NAME);

    if (!projectGraph) {
      return {};
    }

    const sourceProject = findProject(
      projectGraph,
      projectRootMappings,
      sourceFilePath
    );

    // check if source project exists
    if (!sourceProject) {
      return {};
    }

    // check if library has a build target
    const buildTarget = buildTargets.find(
      (t) => sourceProject.data.targets?.[t]
    );
    if (!buildTarget) {
      return {};
    }

    // gather helper dependencies for @nx/js executors
    const helperDependencies = getHelperDependenciesFromProjectGraph(
      workspaceRoot,
      sourceProject.name,
      projectGraph
    );

    // find all dependencies for the project
    const npmDeps = findProjectsNpmDependencies(
      sourceProject,
      projectGraph,
      buildTarget,
      {
        helperDependencies: helperDependencies.map((dep) => dep.target),
      },
      removePackageJsonFromFileMap(projectFileMap)
    );
    const projDependencies = {
      ...npmDeps.dependencies,
      ...npmDeps.peerDependencies,
    };
    const expectedDependencyNames = Object.keys(projDependencies);

    const projPackageJsonPath = join(
      workspaceRoot,
      sourceProject.data.root,
      'package.json'
    );

    globalThis.projPackageJsonDeps ??= getAllDependencies(projPackageJsonPath);
    const projPackageJsonDeps: Record<string, string> =
      globalThis.projPackageJsonDeps;
    const rootPackageJsonDeps = getAllDependencies(
      join(workspaceRoot, 'package.json')
    );

    function validateMissingDependencies(node: AST.JSONProperty) {
      if (!checkMissingDependencies) {
        return;
      }
      const missingDeps = expectedDependencyNames.filter(
        (d) => !projPackageJsonDeps[d] && !ignoredDependencies.includes(d)
      );

      if (missingDeps.length) {
        context.report({
          node: node as any,
          messageId: 'missingDependency',
          data: {
            packageNames: missingDeps.map((d) => `\n    - ${d}`).join(''),
            section: (node.key as JSONLiteral).value,
            projectName: sourceProject.name,
          },
          fix(fixer) {
            missingDeps.forEach((d) => {
              projPackageJsonDeps[d] =
                rootPackageJsonDeps[d] || projDependencies[d];
            });

            const deps = (node.value as AST.JSONObjectExpression).properties;
            const mappedDeps = missingDeps
              .map((d) => `\n    "${d}": "${projPackageJsonDeps[d]}"`)
              .join(',');

            if (deps.length) {
              return fixer.insertTextAfter(
                deps[deps.length - 1] as any,
                `,${mappedDeps}`
              );
            } else {
              return fixer.insertTextAfterRange(
                [node.value.range[0] + 1, node.value.range[1] - 1],
                `${mappedDeps}\n  `
              );
            }
          },
        });
      }
    }

    function validateVersionMatchesInstalled(
      node: AST.JSONProperty,
      packageName: string,
      packageRange: string
    ) {
      if (!checkVersionMismatches) {
        return;
      }
      if (
        projDependencies[packageName] === '*' ||
        satisfies(projDependencies[packageName], packageRange)
      ) {
        return;
      }

      context.report({
        node: node as any,
        messageId: 'versionMismatch',
        data: {
          packageName: packageName,
          version: projDependencies[packageName],
        },
        fix: (fixer) =>
          fixer.replaceText(
            node as any,
            `"${packageName}": "${
              rootPackageJsonDeps[packageName] || projDependencies[packageName]
            }"`
          ),
      });
    }

    function reportObsoleteDependency(
      node: AST.JSONProperty,
      packageName: string
    ) {
      if (!checkObsoleteDependencies) {
        return;
      }

      context.report({
        node: node as any,
        messageId: 'obsoleteDependency',
        data: { packageName: packageName, projectName: sourceProject.name },
        fix: (fixer) => {
          const isLastProperty =
            node.parent.properties[node.parent.properties.length - 1] === node;
          const index = node.parent.properties.findIndex((n) => n === node);

          if (index > 0) {
            const previousNode = node.parent.properties[index - 1];
            return fixer.removeRange([
              previousNode.range[1] + (isLastProperty ? 0 : 1),
              node.range[1] + (isLastProperty ? 0 : 1),
            ]);
          } else {
            const parent = node.parent;

            // it's the only property
            if (isLastProperty) {
              return fixer.removeRange([
                parent.range[0] + 1,
                parent.range[1] - 1,
              ]);
            } else {
              return fixer.removeRange([
                parent.range[0] + 1,
                node.range[1] + 1,
              ]);
            }
          }
        },
      });
    }

    function validateDependenciesSectionExistance(
      node: AST.JSONObjectExpression
    ) {
      if (
        !expectedDependencyNames.length ||
        !expectedDependencyNames.some((d) => !ignoredDependencies.includes(d))
      ) {
        return;
      }
      if (
        !node.properties ||
        !node.properties.some((p) =>
          [
            'dependencies',
            'peerDependencies',
            'devDependencies',
            'optionalDependencies',
          ].includes((p.key as any).value)
        )
      ) {
        context.report({
          node: node as any,
          messageId: 'missingDependencySection',
          data: {
            dependencies: expectedDependencyNames
              .map((d) => `\n- "${d}"`)
              .join(),
          },
          fix: (fixer) => {
            expectedDependencyNames.sort().reduce((acc, d) => {
              acc[d] = rootPackageJsonDeps[d] || projDependencies[d];
              return acc;
            }, projPackageJsonDeps);

            const dependencies = Object.keys(projPackageJsonDeps)
              .map((d) => `\n    "${d}": "${projPackageJsonDeps[d]}"`)
              .join(',');

            if (!node.properties.length) {
              return fixer.replaceText(
                node as any,
                `{\n  "dependencies": {${dependencies}\n  }\n}`
              );
            } else {
              return fixer.insertTextAfter(
                node.properties[node.properties.length - 1] as any,
                `,\n  "dependencies": {${dependencies}\n  }`
              );
            }
          },
        });
      }
    }

    return {
      ['JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=/^(dev|peer|optional)?dependencies$/i]'](
        node: AST.JSONProperty
      ) {
        return validateMissingDependencies(node);
      },
      ['JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=/^(dev|peer|optional)?dependencies$/i] > JSONObjectExpression > JSONProperty'](
        node: AST.JSONProperty
      ) {
        const packageName = (node.key as any).value;
        const packageRange = (node.value as any).value;

        if (ignoredDependencies.includes(packageName)) {
          return;
        }

        if (expectedDependencyNames.includes(packageName)) {
          return validateVersionMatchesInstalled(
            node,
            packageName,
            packageRange
          );
        } else {
          return reportObsoleteDependency(node, packageName);
        }
      },
      ['JSONExpressionStatement > JSONObjectExpression'](
        node: AST.JSONObjectExpression
      ) {
        return validateDependenciesSectionExistance(node);
      },
    };
  },
});
