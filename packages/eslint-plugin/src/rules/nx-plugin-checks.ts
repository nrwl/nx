import type { TSESLint } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import type { AST } from 'jsonc-eslint-parser';
import { readFileSync } from 'fs';
import { tsquery } from '@phenomnomnominal/tsquery';

import {
  ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';
import { getRootTsConfigPath } from '@nx/js';
import { registerTsProject } from '@nx/js/src/internal';
import * as path from 'path';
import { valid } from 'semver';
import { readProjectGraph } from '../utils/project-graph-utils';
import {
  findProject,
  getParserServices,
  getSourceFilePath,
} from '../utils/runtime-lint-utils';

export type Options = [
  {
    generatorsJson?: string;
    executorsJson?: string;
    migrationsJson?: string;
    packageJson?: string;
    allowedVersionStrings: string[];
    tsConfig?: string;
  }
];

type NormalizedOptions = Options[0] & {
  rootDir?: string;
  outDir?: string;
};

const DEFAULT_OPTIONS: Options[0] = {
  generatorsJson: 'generators.json',
  executorsJson: 'executors.json',
  migrationsJson: 'migrations.json',
  packageJson: 'package.json',
  allowedVersionStrings: ['*', 'latest', 'next'],
  tsConfig: 'tsconfig.lib.json',
};

export type MessageIds =
  | 'missingRequiredSchema'
  | 'invalidSchemaPath'
  | 'missingImplementation'
  | 'invalidImplementationPath'
  | 'invalidImplementationModule'
  | 'unableToReadImplementationExports'
  | 'invalidVersion'
  | 'missingVersion'
  | 'noGeneratorsOrSchematicsFound'
  | 'noExecutorsOrBuildersFound'
  | 'valueShouldBeObject';

export const RULE_NAME = 'nx-plugin-checks';

export default ESLintUtils.RuleCreator(() => ``)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    docs: {
      description: 'Checks common nx-plugin configuration files for validity',
    },
    schema: [
      {
        type: 'object',
        properties: {
          generatorsJson: {
            type: 'string',
            description:
              "The path to the project's generators.json file, relative to the project root",
          },
          executorsJson: {
            type: 'string',
            description:
              "The path to the project's executors.json file, relative to the project root",
          },
          migrationsJson: {
            type: 'string',
            description:
              "The path to the project's migrations.json file, relative to the project root",
          },
          packageJson: {
            type: 'string',
            description:
              "The path to the project's package.json file, relative to the project root",
          },
          allowedVersionStrings: {
            type: 'array',
            description:
              'A list of specifiers that are valid for versions within package group. Defaults to ["*", "latest", "next"]',
            items: { type: 'string' },
          },
          tsConfig: {
            type: 'string',
            description:
              'The path to the tsconfig file used to build the plugin. Defaults to "tsconfig.lib.json".',
          },
        },
        additionalProperties: false,
      },
    ],
    type: 'problem',
    messages: {
      invalidSchemaPath: 'Schema path should point to a valid file',
      invalidImplementationPath:
        '{{ key }}: Implementation path should point to a valid file',
      invalidImplementationModule:
        '{{ key }}: Unable to find export {{ identifier }} in implementation module',
      unableToReadImplementationExports:
        '{{ key }}: Unable to read exports for implementation module',
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
    if (!getParserServices(context).isJSON) {
      return {};
    }

    const { projectGraph, projectRootMappings } = readProjectGraph(RULE_NAME);

    const sourceFilePath = getSourceFilePath(
      context.filename ?? context.getFilename(),
      workspaceRoot
    );

    const sourceProject = findProject(
      projectGraph,
      projectRootMappings,
      sourceFilePath
    );
    // If source is not part of an nx workspace, return.
    if (!sourceProject) {
      return {};
    }
    const options = normalizeOptions(sourceProject, context.options[0]);
    context.options[0] = options;
    const { generatorsJson, executorsJson, migrationsJson, packageJson } =
      options;

    if (
      ![generatorsJson, executorsJson, migrationsJson, packageJson].includes(
        sourceFilePath
      )
    ) {
      return {};
    }

    if (!(global as any).tsProjectRegistered) {
      registerTsProject(getRootTsConfigPath());
      (global as any).tsProjectRegistered = true;
    }

    return {
      ['JSONExpressionStatement > JSONObjectExpression'](
        node: AST.JSONObjectExpression
      ) {
        if (sourceFilePath === generatorsJson) {
          checkCollectionFileNode(node, 'generator', context, options);
        } else if (sourceFilePath === migrationsJson) {
          checkCollectionFileNode(node, 'migration', context, options);
        } else if (sourceFilePath === executorsJson) {
          checkCollectionFileNode(node, 'executor', context, options);
        } else if (sourceFilePath === packageJson) {
          validatePackageGroup(node, context);
        }
      },
    };
  },
});

function normalizeOptions(
  sourceProject: ProjectGraphProjectNode,
  options: Options[0]
): NormalizedOptions {
  let rootDir: string;
  let outDir: string;
  const base = { ...DEFAULT_OPTIONS, ...options };
  let runtimeTsConfig: string;

  if (sourceProject.data.targets?.build?.executor === '@nx/js:tsc') {
    rootDir = sourceProject.data.targets.build.options.rootDir;
    outDir = sourceProject.data.targets.build.options.outputPath;
  }

  if (!rootDir && !outDir) {
    try {
      runtimeTsConfig = require.resolve(
        path.join(workspaceRoot, sourceProject.data.root, base.tsConfig)
      );
      const tsConfig = readJsonFile(runtimeTsConfig);
      rootDir ??= tsConfig.compilerOptions?.rootDir
        ? path.join(sourceProject.data.root, tsConfig.compilerOptions.rootDir)
        : undefined;
      outDir ??= tsConfig.compilerOptions?.outDir
        ? path.join(sourceProject.data.root, tsConfig.compilerOptions.outDir)
        : undefined;
    } catch {
      // nothing
    }
  }
  const pathPrefix =
    sourceProject.data.root !== '.' ? `${sourceProject.data.root}/` : '';
  return {
    ...base,
    executorsJson: base.executorsJson
      ? `${pathPrefix}${base.executorsJson}`
      : undefined,
    generatorsJson: base.generatorsJson
      ? `${pathPrefix}${base.generatorsJson}`
      : undefined,
    migrationsJson: base.migrationsJson
      ? `${pathPrefix}${base.migrationsJson}`
      : undefined,
    packageJson: base.packageJson
      ? `${pathPrefix}${base.packageJson}`
      : undefined,
    rootDir,
    outDir,
  };
}

export function checkCollectionFileNode(
  baseNode: AST.JSONObjectExpression,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>,
  options: NormalizedOptions
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
      checkCollectionNode(collectionNode.value, mode, context, options);
    }
  }
}

export function checkCollectionNode(
  baseNode: AST.JSONObjectExpression,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>,
  options: NormalizedOptions
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
        context,
        options
      );
    }
  }
}

export function validateEntry(
  baseNode: AST.JSONObjectExpression,
  key: string,
  mode: 'migration' | 'generator' | 'executor',
  context: TSESLint.RuleContext<MessageIds, Options>,
  options: NormalizedOptions
): void {
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
      let validJsonFound = false;
      const schemaFilePath = path.join(
        path.dirname(context.filename ?? context.getFilename()),
        schemaNode.value.value
      );
      try {
        readJsonFile(schemaFilePath);
        validJsonFound = true;
      } catch {
        try {
          // Try to map back to source, which will be the case with TS solution setup.
          readJsonFile(schemaFilePath.replace(options.outDir, options.rootDir));
          validJsonFound = true;
        } catch {
          // nothing, will be reported below
        }
      }

      if (!validJsonFound) {
        context.report({
          messageId: 'invalidSchemaPath',
          node: schemaNode.value as any,
        });
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
    validateImplementationNode(implementationNode, key, context, options);
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

export function validateImplementationNode(
  implementationNode: AST.JSONProperty,
  key: string,
  context: TSESLint.RuleContext<MessageIds, Options>,
  options: NormalizedOptions
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
      path.dirname(context.filename ?? context.getFilename()),
      implementationPath
    );

    try {
      resolvedPath = require.resolve(modulePath);
    } catch {
      try {
        resolvedPath = require.resolve(
          modulePath.replace(options.outDir, options.rootDir)
        );
      } catch {
        // nothing, will be reported below
      }
    }

    if (!resolvedPath) {
      context.report({
        messageId: 'invalidImplementationPath',
        data: {
          key,
        },
        node: implementationNode.value as any,
      });
    }

    if (identifier) {
      try {
        if (!checkIfIdentifierIsFunction(resolvedPath, identifier)) {
          context.report({
            messageId: 'invalidImplementationModule',
            node: implementationNode.value as any,
            data: {
              identifier,
              key,
            },
          });
        }
      } catch {
        // require can throw if the module is not found
        context.report({
          messageId: 'unableToReadImplementationExports',
          node: implementationNode.value as any,
          data: {
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
          if (
            !validateVersionJsonExpression(versionPropertyNode.value, context)
          )
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
        if (!validateVersionJsonExpression(propertyNode.value, context)) {
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

export function validateVersionJsonExpression(
  node: AST.JSONExpression,
  context: TSESLint.RuleContext<MessageIds, Options>
) {
  return (
    node &&
    node.type === 'JSONLiteral' &&
    typeof node.value === 'string' &&
    (valid(node.value) ||
      context.options[0]?.allowedVersionStrings.includes(node.value))
  );
}

export function checkIfIdentifierIsFunction(
  filePath: string,
  identifier: string
): boolean {
  try {
    const ts = require('typescript');
    const sourceCode = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const exportedFunctions = tsquery(
      sourceFile,
      `
      FunctionDeclaration[name.text="${identifier}"][modifiers],
      ExportDeclaration > FunctionDeclaration[name.text="${identifier}"],
      VariableStatement[modifiers] VariableDeclaration[name.text="${identifier}"] ArrowFunction,
      VariableStatement[modifiers] VariableDeclaration[name.text="${identifier}"] FunctionExpression,
      ExportDeclaration > VariableStatement VariableDeclaration[name.text="${identifier}"] ArrowFunction,
      ExportDeclaration > VariableStatement VariableDeclaration[name.text="${identifier}"] FunctionExpression,
      ExportDeclaration ExportSpecifier[name.text="${identifier}"]
    `
    );

    return exportedFunctions.length > 0;
  } catch {
    // ignore
  }

  // Fallback to require()
  const m = require(filePath);
  return identifier in m && typeof m[identifier] === 'function';
}
