import type { AST } from 'jsonc-eslint-parser';
import type { TSESLint } from '@typescript-eslint/utils';

import { readJsonFile, workspaceRoot } from '@nrwl/devkit';
import {
  findSourceProject,
  getSourceFilePath,
  MappedProjectGraphNode,
} from '@nrwl/workspace/src/utils/runtime-lint-utils';
import { existsSync } from 'fs';
import { registerTsProject } from 'nx/src/utils/register';
import * as path from 'path';

import { createESLintRule } from '../utils/create-eslint-rule';
import { readProjectGraph } from '../utils/project-graph-utils';
import { valid } from 'semver';

type Options = [
  {
    generatorsJson?: string;
    executorsJson?: string;
    migrationsJson?: string;
    packageJson?: string;
  }
];

const DEFAULT_OPTIONS = {
  generatorsJson: 'generators.json',
  executorsJson: 'executors.json',
  migrationsJson: 'migrations.json',
  packageJson: 'package.json',
};

export type MessageIds =
  | 'missingRequiredSchema'
  | 'invalidSchemaPath'
  | 'missingImplementation'
  | 'invalidImplementationPath'
  | 'invalidImplementationModule'
  | 'invalidVersion'
  | 'missingVersion'
  | 'noGeneratorsOrSchematicsFound'
  | 'noExecutorsOrBuildersFound'
  | 'valueShouldBeObject';

export const RULE_NAME = 'nx-plugin-checks';

export default createESLintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    docs: {
      description: 'Checks common nx-plugin configuration files for validity',
      recommended: 'error',
    },
    schema: {},
    type: 'problem',
    messages: {
      invalidSchemaPath: 'Schema path should point to a valid file',
      invalidImplementationPath:
        '{{ key }}: Implementation path should point to a valid file',
      invalidImplementationModule:
        '{{ key }}: Unable to find export {{ identifier }} in implementation module',
      invalidVersion: '{{ key }}: Version should be a valid semver',
      noGeneratorsOrSchematicsFound:
        'Unable to find `generators` or `schematics` property',
      noExecutorsOrBuildersFound:
        'Unable to find `executors` or `builders` property',
      valueShouldBeObject: '{{ key }} should be an object',
      missingRequiredSchema: '{{ key }}: Missing required property - `schema`',
      missingImplementation:
        '{{ key }}: Missing required property - `implementation`',
      missingVersion: '{{ key }}: Missing required property - `version`',
    },
  },
  defaultOptions: [DEFAULT_OPTIONS],
  create(context) {
    // jsonc-eslint-parser adds this property to parserServices where appropriate
    if (!(context.parserServices as any).isJSON) {
      return {};
    }

    const projectGraph = readProjectGraph(RULE_NAME);

    const sourceFilePath = getSourceFilePath(
      context.getFilename(),
      workspaceRoot
    );

    const sourceProject = findSourceProject(projectGraph, sourceFilePath);
    // If source is not part of an nx workspace, return.
    if (!sourceProject) {
      return {};
    }

    const { generatorsJson, executorsJson, migrationsJson, packageJson } =
      normalizeOptions(sourceProject, context.options[0]);

    if (
      ![generatorsJson, executorsJson, migrationsJson, packageJson].includes(
        sourceFilePath
      )
    ) {
      return {};
    }

    if (!(global as any).tsProjectRegistered) {
      registerTsProject(workspaceRoot, 'tsconfig.base.json');
      (global as any).tsProjectRegistered = true;
    }

    return {
      ['JSONExpressionStatement > JSONObjectExpression'](
        node: AST.JSONObjectExpression
      ) {
        if (sourceFilePath === generatorsJson) {
          checkCollectionFileNode(node, 'generator', context);
        } else if (sourceFilePath === migrationsJson) {
          checkCollectionFileNode(node, 'migration', context);
        } else if (sourceFilePath === executorsJson) {
          checkCollectionFileNode(node, 'executor', context);
        } else if (sourceFilePath === packageJson) {
          validatePackageGroup(node, context);
        }
      },
    };
  },
});

function normalizeOptions(
  sourceProject: MappedProjectGraphNode<{}>,
  options: Options[0]
): Options[0] {
  const base = { ...DEFAULT_OPTIONS, ...options };
  return {
    executorsJson: base.executorsJson
      ? `${sourceProject.data.root}/${base.executorsJson}`
      : undefined,
    generatorsJson: base.generatorsJson
      ? `${sourceProject.data.root}/${base.generatorsJson}`
      : undefined,
    migrationsJson: base.migrationsJson
      ? `${sourceProject.data.root}/${base.migrationsJson}`
      : undefined,
    packageJson: base.packageJson
      ? `${sourceProject.data.root}/${base.packageJson}`
      : undefined,
  };
}

export function checkCollectionFileNode(
  baseNode: AST.JSONObjectExpression,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  const schematicsRootNode = baseNode.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'schematics'
  );
  const generatorsRootNode = baseNode.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'generators'
  );

  const executorsRootNode = baseNode.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'executors'
  );
  const buildersRootNode = baseNode.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'builders'
  );

  if (!schematicsRootNode && !generatorsRootNode && mode !== 'executor') {
    context.report({
      messageId: 'noGeneratorsOrSchematicsFound',
      node: baseNode as any,
    });
    return;
  }

  if (!executorsRootNode && !buildersRootNode && mode === 'executor') {
    context.report({
      messageId: 'noExecutorsOrBuildersFound',
      node: baseNode as any,
    });
    return;
  }

  const collectionNodes = [
    { collectionNode: schematicsRootNode, key: 'schematics' },
    { collectionNode: generatorsRootNode, key: 'generators' },
    { collectionNode: executorsRootNode, key: 'executors' },
    { collectionNode: buildersRootNode, key: 'builders' },
  ].filter(({ collectionNode }) => !!collectionNode);

  for (const { collectionNode, key } of collectionNodes) {
    if (collectionNode.value.type !== 'JSONObjectExpression') {
      context.report({
        messageId: 'valueShouldBeObject',
        data: { key },
        node: schematicsRootNode as any,
      });
    } else {
      checkCollectionNode(collectionNode.value, mode, context);
    }
  }
}

export function checkCollectionNode(
  baseNode: AST.JSONObjectExpression,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  const entries = baseNode.properties;

  for (const entryNode of entries) {
    if (entryNode.value.type !== 'JSONObjectExpression') {
      context.report({
        messageId: 'valueShouldBeObject',
        data: { key: (entryNode.key as AST.JSONLiteral).value },
        node: entryNode as any,
      });
    } else if (entryNode.key.type === 'JSONLiteral') {
      validateEntry(
        entryNode.value,
        entryNode.key.value.toString(),
        mode,
        context
      );
    }
  }
}

export function validateEntry(
  baseNode: AST.JSONObjectExpression,
  key: string,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  const schemaNode = baseNode.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'schema'
  );
  if (mode !== 'migration' && !schemaNode) {
    context.report({
      messageId: 'missingRequiredSchema',
      data: {
        key,
      },
      node: baseNode as any,
    });
  } else if (schemaNode) {
    if (
      schemaNode.value.type !== 'JSONLiteral' ||
      typeof schemaNode.value.value !== 'string'
    ) {
      context.report({
        messageId: 'invalidSchemaPath',
        node: schemaNode.value as any,
      });
    } else {
      const schemaFilePath = path.join(
        path.dirname(context.getFilename()),
        schemaNode.value.value
      );
      if (!existsSync(schemaFilePath)) {
        context.report({
          messageId: 'invalidSchemaPath',
          node: schemaNode.value as any,
        });
      } else {
        try {
          readJsonFile(schemaFilePath);
        } catch (e) {
          context.report({
            messageId: 'invalidSchemaPath',
            node: schemaNode.value as any,
          });
        }
      }
    }
  }

  const implementationNode = baseNode.properties.find(
    (x) =>
      x.key.type === 'JSONLiteral' &&
      (x.key.value === 'implementation' || x.key.value === 'factory')
  );
  if (!implementationNode) {
    context.report({
      messageId: 'missingImplementation',
      data: {
        key,
      },
      node: baseNode as any,
    });
  } else {
    validateImplemenationNode(implementationNode, key, context);
  }

  if (mode === 'migration') {
    const versionNode = baseNode.properties.find(
      (x) => x.key.type === 'JSONLiteral' && x.key.value === 'version'
    );
    if (!versionNode) {
      context.report({
        messageId: 'missingVersion',
        data: {
          key,
        },
        node: baseNode as any,
      });
    } else if (
      versionNode.value.type !== 'JSONLiteral' ||
      typeof versionNode.value.value !== 'string'
    ) {
      context.report({
        messageId: 'invalidVersion',
        data: {
          key,
        },
        node: versionNode.value as any,
      });
    } else {
      const specifiedVersion = versionNode.value.value;
      if (!valid(specifiedVersion)) {
        context.report({
          messageId: 'invalidVersion',
          data: {
            key,
          },
          node: versionNode.value as any,
        });
      }
    }
  }
}

export function validateImplemenationNode(
  implementationNode: AST.JSONProperty,
  key: string,
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  if (
    implementationNode.value.type !== 'JSONLiteral' ||
    typeof implementationNode.value.value !== 'string'
  ) {
    context.report({
      messageId: 'invalidImplementationPath',
      data: {
        key,
      },
      node: implementationNode.value as any,
    });
  } else {
    const [implementationPath, identifier] =
      implementationNode.value.value.split('#');
    let resolvedPath: string;

    const modulePath = path.join(
      path.dirname(context.getFilename()),
      implementationPath
    );

    try {
      resolvedPath = require.resolve(modulePath);
    } catch (e) {
      context.report({
        messageId: 'invalidImplementationPath',
        data: {
          key,
        },
        node: implementationNode.value as any,
      });
    }

    if (identifier) {
      const m = require(resolvedPath);
      if (!(identifier in m && typeof m[identifier] === 'function')) {
        context.report({
          messageId: 'invalidImplementationModule',
          node: implementationNode.value as any,
          data: {
            identifier,
            key,
          },
        });
      }
    }
  }
}

export function validatePackageGroup(
  baseNode: AST.JSONObjectExpression,
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  const migrationsNode = baseNode.properties.find(
    (x) =>
      x.key.type === 'JSONLiteral' &&
      x.value.type === 'JSONObjectExpression' &&
      (x.key.value === 'nx-migrations' ||
        x.key.value === 'ng-update' ||
        x.key.value === 'migrations')
  )?.value as AST.JSONObjectExpression;

  const packageGroupNode = migrationsNode?.properties.find(
    (x) => x.key.type === 'JSONLiteral' && x.key.value === 'packageGroup'
  );

  if (packageGroupNode) {
    // Package group is defined as an array
    if (packageGroupNode.value.type === 'JSONArrayExpression') {
      // Look at entries which are an object
      const members = packageGroupNode.value.elements.filter(
        (x) => x.type === 'JSONObjectExpression'
      );
      // validate that the version property exists and is valid
      for (const member of members) {
        const versionPropertyNode = (
          member as AST.JSONObjectExpression
        ).properties.find(
          (x) => x.key.type === 'JSONLiteral' && x.key.value === 'version'
        );
        const packageNode = (
          member as AST.JSONObjectExpression
        ).properties.find(
          (x) => x.key.type === 'JSONLiteral' && x.key.value === 'package'
        );
        const key = (packageNode?.value as AST.JSONLiteral)?.value ?? 'unknown';

        if (versionPropertyNode) {
          if (!validateVersionJsonExpression(versionPropertyNode.value))
            context.report({
              messageId: 'invalidVersion',
              data: { key },
              node: versionPropertyNode.value as any,
            });
        } else {
          context.report({
            messageId: 'missingVersion',
            data: { key },
            node: member as any,
          });
        }
      }
      // Package group is defined as an object (Record<PackageName, Version>)
    } else if (packageGroupNode.value.type === 'JSONObjectExpression') {
      const properties = packageGroupNode.value.properties;
      // For each property, ensure its value is a valid version
      for (const propertyNode of properties) {
        if (!validateVersionJsonExpression(propertyNode.value)) {
          context.report({
            messageId: 'invalidVersion',
            data: {
              key: (propertyNode.key as AST.JSONLiteral).value,
            },
            node: propertyNode.value as any,
          });
        }
      }
    }
  }
}

export function validateVersionJsonExpression(node: AST.JSONExpression) {
  return (
    node &&
    node.type === 'JSONLiteral' &&
    typeof node.value === 'string' &&
    valid(node.value)
  );
}
