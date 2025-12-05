import { NX_VERSION, normalizePath, workspaceRoot } from '@nx/devkit';
import { getCatalogManager } from '@nx/devkit/src/utils/catalog';
import { findNpmDependencies } from '@nx/js/src/utils/find-npm-dependencies';
import { ESLintUtils } from '@typescript-eslint/utils';
import { AST } from 'jsonc-eslint-parser';
import { type JSONLiteral } from 'jsonc-eslint-parser/lib/parser/ast';
import { join } from 'path';
import { satisfies } from 'semver';
import {
  getAllDependencies,
  getPackageJson,
  getProductionDependencies,
} from '../utils/package-json-utils';
import { readProjectGraph } from '../utils/project-graph-utils';
import {
  findProject,
  getParserServices,
  getSourceFilePath,
} from '../utils/runtime-lint-utils';

const WORKSPACE_VERSION_WILDCARD = 'workspace:*';

export type Options = [
  {
    buildTargets?: string[];
    checkMissingDependencies?: boolean;
    checkObsoleteDependencies?: boolean;
    checkVersionMismatches?: boolean;
    ignoredDependencies?: string[];
    ignoredFiles?: string[];
    includeTransitiveDependencies?: boolean;
    useLocalPathsForWorkspaceDependencies?: boolean;
    runtimeHelpers?: string[];
    peerDepsVersionStrategy?: 'installed' | 'workspace';
  }
];

export type MessageIds =
  | 'missingDependency'
  | 'obsoleteDependency'
  | 'versionMismatch'
  | 'missingDependencySection'
  | 'invalidCatalogReference';

export const RULE_NAME = 'dependency-checks';

export default ESLintUtils.RuleCreator(
  () =>
    `https://github.com/nrwl/nx/blob/${NX_VERSION}/docs/generated/packages/eslint-plugin/documents/dependency-checks.md`
)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Checks dependencies in project's package.json for version mismatches`,
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          buildTargets: { type: 'array', items: { type: 'string' } },
          ignoredDependencies: { type: 'array', items: { type: 'string' } },
          ignoredFiles: { type: 'array', items: { type: 'string' } },
          checkMissingDependencies: { type: 'boolean' },
          checkObsoleteDependencies: { type: 'boolean' },
          checkVersionMismatches: { type: 'boolean' },
          includeTransitiveDependencies: { type: 'boolean' },
          useLocalPathsForWorkspaceDependencies: { type: 'boolean' },
          runtimeHelpers: { type: 'array', items: { type: 'string' } },
          peerDepsVersionStrategy: {
            type: 'string',
            enum: ['installed', 'workspace'],
            description:
              'Strategy for peer dependency versions. "installed" uses versions from root package.json (default). "workspace" uses workspace:* for all peer dependencies to ensure version synchronization in integrated monorepos.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingDependency: `The "{{projectName}}" project uses the following packages, but they are missing from "{{section}}":{{packageNames}}`,
      obsoleteDependency: `The "{{packageName}}" package is not used by "{{projectName}}" project.`,
      versionMismatch: `The version specifier does not contain the installed version of "{{packageName}}" package: {{version}}.`,
      missingDependencySection: `Dependency sections are missing from the "package.json" but following dependencies were detected:{{dependencies}}`,
      invalidCatalogReference: `Invalid catalog reference for "{{packageName}}": {{error}}`,
    },
  },
  defaultOptions: [
    {
      buildTargets: ['build'],
      checkMissingDependencies: true,
      checkObsoleteDependencies: true,
      checkVersionMismatches: true,
      ignoredDependencies: [],
      ignoredFiles: [],
      includeTransitiveDependencies: false,
      useLocalPathsForWorkspaceDependencies: false,
      runtimeHelpers: [],
      peerDepsVersionStrategy: 'installed',
    },
  ],
  create(
    context,
    [
      {
        buildTargets,
        ignoredDependencies,
        ignoredFiles,
        checkMissingDependencies,
        checkObsoleteDependencies,
        checkVersionMismatches,
        includeTransitiveDependencies,
        useLocalPathsForWorkspaceDependencies,
        runtimeHelpers,
        peerDepsVersionStrategy = 'installed',
      },
    ]
  ) {
    if (!getParserServices(context).isJSON) {
      return {};
    }
    const fileName = normalizePath(context.filename ?? context.getFilename());
    // support only package.json
    if (!fileName.endsWith('/package.json')) {
      return {};
    }

    const sourceFilePath = getSourceFilePath(fileName, workspaceRoot);
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

    const rootPackageJson = getPackageJson(join(workspaceRoot, 'package.json'));

    const npmDependencies = findNpmDependencies(
      workspaceRoot,
      sourceProject,
      projectGraph,
      projectFileMap,
      buildTarget, // TODO: What if child library has a build target different from the parent?
      {
        includeTransitiveDependencies,
        ignoredFiles,
        useLocalPathsForWorkspaceDependencies,
        runtimeHelpers,
      }
    );
    const expectedDependencyNames = Object.keys(npmDependencies);

    const packageJson = JSON.parse(context.sourceCode.getText());
    const projPackageJsonDeps = getProductionDependencies(packageJson);

    const rootPackageJsonDeps = getAllDependencies(rootPackageJson);

    function getDependencySection(node: AST.JSONProperty): string | undefined {
      // Check if this node is a dependency section itself
      const directSection = (node.key as JSONLiteral)?.value as string;
      if (
        ['dependencies', 'peerDependencies', 'optionalDependencies'].includes(
          directSection
        )
      ) {
        return directSection;
      }

      // Otherwise, traverse up to find the parent section
      const sectionProp = node.parent?.parent as AST.JSONProperty | undefined;
      return (sectionProp?.key as JSONLiteral | undefined)?.value as
        | string
        | undefined;
    }

    function validateMissingDependencies(node: AST.JSONProperty) {
      if (!checkMissingDependencies) {
        return;
      }
      const missingDeps = expectedDependencyNames.filter(
        (d) => !projPackageJsonDeps[d] && !ignoredDependencies.includes(d)
      );

      if (missingDeps.length) {
        const dependencySection = getDependencySection(node);

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
              if (
                dependencySection === 'peerDependencies' &&
                peerDepsVersionStrategy === 'workspace'
              ) {
                projPackageJsonDeps[d] = WORKSPACE_VERSION_WILDCARD;
              } else {
                projPackageJsonDeps[d] =
                  rootPackageJsonDeps[d] || npmDependencies[d];
              }
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

    function validateCatalogReferenceForPackage(
      node: AST.JSONProperty,
      packageName: string,
      packageRange: string
    ) {
      const manager = getCatalogManager(workspaceRoot);
      if (!manager) {
        return;
      }

      if (!manager.isCatalogReference(packageRange)) {
        return;
      }

      try {
        manager.validateCatalogReference(
          workspaceRoot,
          packageName,
          packageRange
        );
      } catch (error) {
        context.report({
          node: node as any,
          messageId: 'invalidCatalogReference',
          data: {
            packageName: packageName,
            error: error.message,
          },
        });
      }
    }

    function validateVersionMatchesInstalled(
      node: AST.JSONProperty,
      packageName: string,
      packageRange: string
    ) {
      if (!checkVersionMismatches) return;

      const dependencySection = getDependencySection(node);

      if (
        dependencySection === 'peerDependencies' &&
        peerDepsVersionStrategy === 'workspace' &&
        packageRange !== WORKSPACE_VERSION_WILDCARD
      ) {
        context.report({
          node: node as any,
          messageId: 'versionMismatch',
          data: { packageName, version: WORKSPACE_VERSION_WILDCARD },
          fix: (fixer) =>
            fixer.replaceText(
              node as any,
              `"${packageName}": "${WORKSPACE_VERSION_WILDCARD}"`
            ),
        });
        return;
      }

      // Resolve catalog references before validation
      let resolvedPackageRange = packageRange;
      const manager = getCatalogManager(workspaceRoot);

      if (manager?.isCatalogReference(packageRange)) {
        const resolved = manager.resolveCatalogReference(
          workspaceRoot,
          packageName,
          packageRange
        );

        if (!resolved) {
          // Catalog resolution failed - this shouldn't happen because
          // validateCatalogReferenceForPackage should have caught it earlier
          // But if it does, skip validation gracefully
          return;
        }

        resolvedPackageRange = resolved;
      }

      if (
        npmDependencies[packageName].startsWith('file:') ||
        resolvedPackageRange.startsWith('file:') ||
        npmDependencies[packageName] === '*' ||
        resolvedPackageRange === '*' ||
        resolvedPackageRange.startsWith('workspace:') ||
        satisfies(npmDependencies[packageName], resolvedPackageRange, {
          includePrerelease: true,
        })
      ) {
        return;
      }

      context.report({
        node: node as any,
        messageId: 'versionMismatch',
        data: {
          packageName: packageName,
          version: npmDependencies[packageName],
        },
        fix: (fixer) =>
          fixer.replaceText(
            node as any,
            `"${packageName}": "${
              rootPackageJsonDeps[packageName] || npmDependencies[packageName]
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
          ['dependencies', 'peerDependencies', 'optionalDependencies'].includes(
            (p.key as any).value
          )
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
              acc[d] = rootPackageJsonDeps[d] || npmDependencies[d];
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
      ['JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=/^(peer|optional)?dependencies$/i]'](
        node: AST.JSONProperty
      ) {
        validateMissingDependencies(node);
      },
      ['JSONExpressionStatement > JSONObjectExpression > JSONProperty[key.value=/^(peer|optional)?dependencies$/i] > JSONObjectExpression > JSONProperty'](
        node: AST.JSONProperty
      ) {
        const packageName = (node.key as any).value;
        const packageRange = (node.value as any).value;

        if (ignoredDependencies.includes(packageName)) {
          return;
        }

        validateCatalogReferenceForPackage(node, packageName, packageRange);

        if (expectedDependencyNames.includes(packageName)) {
          validateVersionMatchesInstalled(node, packageName, packageRange);
        } else {
          reportObsoleteDependency(node, packageName);
        }
      },
      ['JSONExpressionStatement > JSONObjectExpression'](
        node: AST.JSONObjectExpression
      ) {
        validateDependenciesSectionExistance(node);
      },
    };
  },
});
