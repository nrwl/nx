import {
  CallExpression,
  createPrinter,
  createSourceFile,
  Expression,
  Identifier,
  isCallExpression,
  isExportAssignment,
  isNumericLiteral,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isSpreadAssignment,
  Node,
  NodeFactory,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  ScriptTarget,
  SourceFile,
  StringLiteral,
  SyntaxKind,
  transform,
  TransformationContext,
  TransformerFactory,
  visitEachChild,
  visitNode,
  Visitor,
} from 'typescript';
import { InternalResolvedConfigOptions } from './cypress-config.model';
import {
  CypressConfigPropertyPath,
  isBooleanLiteral,
  Overwrite,
} from './transformer.helper';

export type ModifiedCypressConfig = Partial<
  Overwrite<
    InternalResolvedConfigOptions,
    {
      component?: Overwrite<
        InternalResolvedConfigOptions['component'],
        { devServer?: { tsConfig: string; compiler: string } }
      >;
    }
  >
>;

type PrimitiveValue = string | number | boolean;
type DevServer = {
  [key in 'tsConfig' | 'compiler']?: PrimitiveValue;
};
type UpsertArgs = {
  type: 'upsert';
  newConfig: ModifiedCypressConfig;
  overwrite?: boolean;
};
type DeleteArgs = { type: 'delete' };

const devServerPositionalArgument = ['tsConfig', 'compiler'] as const;

/**
 * Update cypress.config.ts file properties.
 * Does not support cypress.config.json. use updateJson from @nrwl/devkit
 */
export class CypressConfigTransformer {
  private static configMetadataMap = new Map<
    string,
    PrimitiveValue | Map<string, PrimitiveValue | DevServer>
  >();

  private static propertiesToRemove: CypressConfigPropertyPath[] = [];

  private static sourceFile: SourceFile;

  static removeProperties(
    existingConfigContent: string,
    toRemove: CypressConfigPropertyPath[]
  ): string {
    this.configMetadataMap = new Map();
    this.propertiesToRemove = toRemove;

    this.sourceFile = createSourceFile(
      'cypress.config.ts',
      existingConfigContent,
      ScriptTarget.Latest,
      true
    );

    const transformedResult = transform(this.sourceFile, [
      this.changePropertiesTransformer({ type: 'delete' }),
    ]);

    return createPrinter().printFile(transformedResult.transformed[0]);
  }

  static addOrUpdateProperties(
    existingConfigContent: string,
    newConfig: ModifiedCypressConfig,
    overwrite = false
  ): string {
    this.configMetadataMap = new Map();
    this.propertiesToRemove = [];

    this.sourceFile = createSourceFile(
      'cypress.config.ts',
      existingConfigContent,
      ScriptTarget.Latest,
      true
    );

    const transformedResult = transform(this.sourceFile, [
      this.changePropertiesTransformer({
        type: 'upsert',
        newConfig,
        overwrite,
      }),
    ]);

    return createPrinter().printFile(transformedResult.transformed[0]);
  }

  private static changePropertiesTransformer(
    change: UpsertArgs | DeleteArgs
  ): TransformerFactory<SourceFile> {
    return (context: TransformationContext) => {
      if (change.type === 'upsert') {
        // before visiting the sourceFile (aka the existing config)
        // we add the newConfig, as TypeScript AST, to our ConfigMetadata
        const newConfigAst: ObjectLiteralExpression =
          context.factory.createObjectLiteralExpression(
            Object.entries(change.newConfig).map(([configKey, configValue]) =>
              createObjectAssignments(context.factory, configKey, configValue)
            ),
            true
          );

        this.buildMetadataFromConfig(context.factory, newConfigAst);
      }
      return (sourceFile: SourceFile) => {
        const nodeVisitor: Visitor = (node: Node): Node => {
          if (isExportAssignment(node)) {
            const callExpression = node.expression as CallExpression;
            const rootConfigNode = callExpression
              .arguments[0] as ObjectLiteralExpression;

            if (
              change.type === 'delete' ||
              (change.type === 'upsert' && !change.overwrite)
            ) {
              this.buildMetadataFromConfig(context.factory, rootConfigNode);
            }

            return context.factory.updateExportAssignment(
              node,
              node.decorators,
              node.modifiers,
              context.factory.updateCallExpression(
                callExpression,
                callExpression.expression,
                callExpression.typeArguments,
                [
                  context.factory.createObjectLiteralExpression(
                    [...this.configMetadataMap.entries()]
                      .map(([configKey, configValue]) => {
                        return createObjectAssignments(
                          context.factory,
                          configKey,
                          configValue
                        );
                      })
                      .sort((propA, propB) =>
                        isSpreadAssignment(propA) ? -1 : 1
                      ),
                    true
                  ),
                ]
              )
            );
          }

          return visitEachChild(node, nodeVisitor, context);
        };

        return visitNode(sourceFile, nodeVisitor);
      };
    };
  }

  private static buildMetadataFromConfig(
    factory: NodeFactory,
    config: ObjectLiteralExpression,
    metadataMap = this.configMetadataMap,
    propertiesToRemove: CypressConfigPropertyPath[] = this.propertiesToRemove,
    parentPrefix = ''
  ): void {
    if (!Array.isArray(config.properties)) {
      console.log(config);
      return;
    }

    for (const property of config.properties) {
      let assignment = property;
      if (isPropertyAssignment(property)) {
        const assignmentName = (assignment.name as Identifier).text;
        const propertyPath = parentPrefix
          ? parentPrefix.concat('.', assignmentName)
          : assignmentName;

        if (
          propertiesToRemove.includes(propertyPath as CypressConfigPropertyPath)
        ) {
          continue;
        }

        if (assignmentName === 'devServer') {
          if (isCallExpression(assignment.initializer)) {
            assignment = factory.updatePropertyAssignment(
              assignment,
              assignment.name,
              factory.createObjectLiteralExpression(
                assignment.initializer.arguments.map((arg, index) => {
                  return factory.createPropertyAssignment(
                    factory.createIdentifier(
                      devServerPositionalArgument[index]
                    ),
                    arg
                  );
                }),
                true
              )
            );
          }
        }

        const existingMetadata = metadataMap.get(assignmentName);
        if (existingMetadata !== undefined) {
          if (existingMetadata instanceof Map) {
            if (isCallExpression(assignment.initializer)) {
              existingMetadata.set(
                assignment.initializer.expression.getFullText(),
                [
                  // we are in an existing object so now we need to spread the existing object
                  // i.e. { blah: somFn(args)} => { blah: {...someFn(args), anotherProp} }
                  SyntaxKind.SpreadAssignment,
                  assignment.initializer.arguments,
                ] as any
              );
            } else {
              this.buildMetadataFromConfig(
                factory,
                assignment.initializer as ObjectLiteralExpression,
                existingMetadata as any,
                propertiesToRemove,
                propertyPath
              );
            }
          }
          continue;
        }

        if (isObjectLiteralExpression(assignment.initializer)) {
          const childMetadataMap = new Map();
          metadataMap.set(assignmentName, childMetadataMap);
          this.buildMetadataFromConfig(
            factory,
            assignment.initializer,
            childMetadataMap,
            propertiesToRemove,
            propertyPath
          );
        } else if (isCallExpression(assignment.initializer)) {
          metadataMap.set(assignmentName, [
            assignment.initializer.kind,
            assignment.initializer.expression.getFullText(),
            assignment.initializer.arguments,
          ] as any);
        } else {
          metadataMap.set(
            assignmentName,
            fromLiteralToPrimitive(assignment.initializer)
          );
        }
      } else if (isSpreadAssignment(property)) {
        if (isCallExpression(property.expression)) {
          const callExpression = property.expression;
          metadataMap.set(callExpression.expression.getFullText(), [
            SyntaxKind.SpreadAssignment,
            callExpression.arguments,
          ] as any);
        }
      }
    }
  }
}

function fromLiteralToPrimitive(nodeInitializer: Expression): PrimitiveValue {
  if (isNumericLiteral(nodeInitializer)) {
    return Number(nodeInitializer.text);
  }

  if (isBooleanLiteral(nodeInitializer)) {
    if (nodeInitializer.kind === SyntaxKind.TrueKeyword) {
      return true;
    }

    if (nodeInitializer.kind === SyntaxKind.FalseKeyword) {
      return false;
    }
  }

  return (nodeInitializer as StringLiteral).text;
}

function createObjectAssignments(
  factory: NodeFactory,
  key: string,
  value:
    | unknown
    | [type: SyntaxKind, args: Expression[]]
    | [type: SyntaxKind, identifier: string, args: Expression[]]
): ObjectLiteralElementLike {
  if (key === 'devServer' && value instanceof Map) {
    return factory.createPropertyAssignment(
      factory.createIdentifier('devServer'),
      factory.createCallExpression(
        factory.createIdentifier('componentDevServer'),
        undefined,
        // TODO(caleb): parse args into correct types
        //  if we use anything other than string down the road
        Array.from(value.values()).map((v) =>
          factory.createStringLiteral(v, true)
        )
      )
    );
  }

  if (Array.isArray(value)) {
    if (value[0] === SyntaxKind.CallExpression) {
      // this handle the case where the property assignment is a fn call;
      return factory.createPropertyAssignment(
        factory.createIdentifier(key),
        factory.createCallExpression(
          factory.createIdentifier(value[1]),
          undefined,
          value[2]
        )
      );
    } else if (value[0] === SyntaxKind.SpreadAssignment) {
      return factory.createSpreadAssignment(
        factory.createCallExpression(
          factory.createIdentifier(key),
          undefined,
          value[1]
        )
      );
    }
  }

  switch (typeof value) {
    case 'number':
      return factory.createPropertyAssignment(
        factory.createIdentifier(key),
        factory.createNumericLiteral(value)
      );
    case 'string':
      return factory.createPropertyAssignment(
        factory.createIdentifier(key),
        factory.createStringLiteral(value, true)
      );
    case 'boolean':
      return factory.createPropertyAssignment(
        factory.createIdentifier(key),
        value ? factory.createTrue() : factory.createFalse()
      );

    case 'object':
      let configEntries = Object.entries(value);

      if (value instanceof Map) {
        configEntries = Array.from(value.entries());
      }

      return factory.createPropertyAssignment(
        factory.createIdentifier(key),
        factory.createObjectLiteralExpression(
          configEntries
            .map(([configKey, configValue]) => {
              return createObjectAssignments(factory, configKey, configValue);
            })
            // make sure spread assignments go first, so they don't override the properties.
            .sort((propA, propB) => (isSpreadAssignment(propA) ? -1 : 1)),
          true
        )
      );
  }
}
