import {
  CallExpression,
  isExportAssignment,
  isNumericLiteral,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteralLike,
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
  TransformationContext,
  TransformerFactory,
  visitEachChild,
  visitNode,
  Visitor,
} from 'typescript';
import { defineConfig } from 'cypress';

export type CypressConfigWithoutDevServer = Omit<
  Parameters<typeof defineConfig>[0],
  'component'
> & {
  component?: Omit<
    Parameters<typeof defineConfig>[0]['component'],
    'devServer'
  >;
};

function mergedCypressConfigurations(
  context: TransformationContext,
  configNode: ObjectLiteralExpression,
  newConfig: CypressConfigWithoutDevServer
) {
  const { component: newComponent, e2e: newE2E, ...newTopLevel } = newConfig;
  // TODO can't JSON parse this. as it's not JSON. how to revive this object?
  // can I just traverse the object and replace the values if found?
  // const logNode = (node) => {
  //   if (isPropertyAssignment(node)) {
  //     console.log(node.getText());
  //   }
  //   return visitEachChild(node, logNode, context);
  // };
  // visitEachChild(configNode, logNode, context);

  // const e2eNode = configNode.properties.find(
  //   (p) => p.name.getText() === 'e2e'
  // ) as PropertyAssignment;
  // const componentNode = configNode.properties.find(
  //   (p) => p.name.getText() === 'component'
  // ) as PropertyAssignment;
  // const topLevelNode = configNode.properties.filter(
  //   (p) => p.name.getText() !== 'e2e' && p.name.getText() !== 'component'
  // ) as PropertyAssignment[];

  const oldConfig = getConfigAsObject(configNode);

  const {
    component: existingComponent,
    e2e: existingE2E,
    ...parsedTopLevel
  }: CypressConfigWithoutDevServer = oldConfig;
  const mergedConfig: CypressConfigWithoutDevServer = {
    ...parsedTopLevel,
    ...newTopLevel,
  };

  if (newComponent || existingComponent) {
    mergedConfig['component'] = {
      ...(existingComponent || {}),
      ...(newComponent || {}),
    };
  }
  if (newE2E || existingE2E) {
    mergedConfig['e2e'] = {
      ...(existingE2E || {}),
      ...(newE2E || {}),
    };
  }

  return mergedConfig;
}

export function mergeCypressConfigs(
  newConfig: CypressConfigWithoutDevServer,
  overwrite: boolean
): TransformerFactory<SourceFile> {
  return (context: TransformationContext) => {
    return (sourceFile: SourceFile) => {
      const visitor: Visitor = (node: Node): Node => {
        // TODO(caleb): only get the default export
        if (isExportAssignment(node)) {
          const callExpression = node.expression as CallExpression;

          const configNode = callExpression
            .arguments[0] as ObjectLiteralExpression;

          // read in existing configuration,
          // somehow I need to still keep properties like
          // the devServer which is a function and not serializable.
          let config;
          if (overwrite) {
            config = newConfig;
          } else {
            config = mergedCypressConfigurations(
              context,
              configNode,
              newConfig
            );
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
                context.factory.updateObjectLiteralExpression(
                  configNode,
                  // TODO(caleb): null check and create an empty object if null
                  Object.entries(config).map(([key, value]) =>
                    createAssignment(context, key, value)
                  )
                ),
              ]
            )
          );
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor);
    };
  };
}

function createAssignment(
  context: TransformationContext,
  propertyName: string,
  value: unknown
): PropertyAssignment {
  switch (typeof value) {
    case 'boolean':
      return context.factory.createPropertyAssignment(
        context.factory.createIdentifier(propertyName),
        value ? context.factory.createTrue() : context.factory.createFalse()
      );
    case 'number':
      return context.factory.createPropertyAssignment(
        context.factory.createIdentifier(propertyName),
        context.factory.createNumericLiteral(value)
      );

    case 'string':
      return context.factory.createPropertyAssignment(
        context.factory.createIdentifier(propertyName),
        context.factory.createStringLiteral(value, true)
      );

    case 'object':
      return context.factory.createPropertyAssignment(
        context.factory.createIdentifier(propertyName),
        context.factory.createObjectLiteralExpression(
          Object.entries(value).map(([nestedKey, nestedValue]) => {
            return createAssignment(context, nestedKey, nestedValue);
          }),
          true
        )
      );
    default:
      throw new Error(
        `Unsupported type ${typeof value}. Only Boolean, Number, and String are supported.`
      );
  }
}

function getConfigAsObject(objectNode: ObjectLiteralExpression) {
  const oldConfig = {};
  for (const prop of objectNode.properties) {
    if (isPropertyAssignment(prop)) {
      if (isStringLiteralLike(prop.initializer)) {
        oldConfig[prop.name.getText()] = prop.initializer.text;
      } else if (
        // TODO(caleb): I don't see an isBoolean or isFalse,isTrue
        prop.initializer.kind === SyntaxKind.FalseKeyword ||
        prop.initializer.kind === SyntaxKind.TrueKeyword
      ) {
        oldConfig[prop.name.getText()] =
          prop.initializer.getText().toLowerCase() === 'true';
      } else if (isNumericLiteral(prop.initializer)) {
        oldConfig[prop.name.getText()] = Number(prop.initializer.getText());
      } else if (isObjectLiteralExpression(prop.initializer)) {
        oldConfig[prop.name.getText()] = getConfigAsObject(
          prop.initializer as ObjectLiteralExpression
        );
      } else {
        // TODO(caleb): special handle devServer
        console.log(
          'unknown kind',
          prop.initializer.kind,
          prop.initializer.getText()
        );
      }
    } else {
      console.log('is not property assignment', prop.getText());
    }
  }
  return oldConfig;
}


export function createPropertyWithExpression(context: TransformationContext,
  propertyName: string,
  expressionName: string,
  expressionArgs: Array<string | boolean | number>
): PropertyAssignment {
  return context.factory.createPropertyAssignment(
    context.factory.createIdentifier(propertyName),
    context.factory.createCallExpression(
      context.factory.createIdentifier(expressionName),
      undefined,
      expressionArgs.map(arg => {
        switch (typeof arg) {
          case 'string':
            return context.factory.createStringLiteral(arg);
          case 'number':
            return context.factory.createNumericLiteral(arg);
          case 'boolean':
            return arg ? context.factory.createTrue() : context.factory.createFalse()
        }
      })
    )
  )
}
