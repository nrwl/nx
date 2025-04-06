import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type {
  ObjectLiteralExpression,
  Printer,
  PropertyAssignment,
} from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
  removeObjectProperty,
  updateObjectProperty,
} from '../../utils/migrations';

let printer: Printer;
let ts: typeof import('typescript');

// https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
// https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalSkipDomainInjection%20configuration%20has%20been,injectDocumentDomain%20configuration
export default async function (tree: Tree) {
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      // cypress config file doesn't exist, so skip
      continue;
    }

    ts ??= ensureTypescript();
    printer ??= ts.createPrinter();

    const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
    const updatedConfig = setInjectDocumentDomain(cypressConfig);

    tree.write(cypressConfigPath, updatedConfig);
  }

  await formatFiles(tree);
}

function setInjectDocumentDomain(cypressConfig: string): string {
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  const sourceFile = tsquery.ast(cypressConfig);
  let e2eProperty = getObjectProperty(config, 'e2e');
  let componentProperty = getObjectProperty(config, 'component');
  let updatedConfig = config;

  const experimentalSkipDomainInjectionProperty = getObjectProperty(
    updatedConfig,
    'experimentalSkipDomainInjection'
  );
  if (experimentalSkipDomainInjectionProperty) {
    updatedConfig = removeObjectProperty(
      updatedConfig,
      experimentalSkipDomainInjectionProperty
    );
  }
  if (
    (!experimentalSkipDomainInjectionProperty ||
      !ts.isArrayLiteralExpression(
        experimentalSkipDomainInjectionProperty.initializer
      ) ||
      !experimentalSkipDomainInjectionProperty.initializer.elements.length) &&
    (!e2eProperty || !ts.isObjectLiteralExpression(e2eProperty.initializer)) &&
    (!componentProperty ||
      !ts.isObjectLiteralExpression(componentProperty.initializer))
  ) {
    // it's not set or it's set to an empty array and there are no e2e or
    // component configs set to an object, so we set the injectDocumentDomain
    // property to true
    updatedConfig = setInjectDocumentDomainInObjectLiteral(updatedConfig);
  }

  if (e2eProperty && ts.isObjectLiteralExpression(e2eProperty.initializer)) {
    const experimentalSkipDomainInjectionProperty = getObjectProperty(
      e2eProperty.initializer,
      'experimentalSkipDomainInjection'
    );
    if (experimentalSkipDomainInjectionProperty) {
      const updatedE2eProperty = removeObjectProperty(
        e2eProperty.initializer,
        experimentalSkipDomainInjectionProperty
      );
      updatedConfig = updateObjectProperty(updatedConfig, e2eProperty, {
        newValue: updatedE2eProperty,
      });
      e2eProperty = getObjectProperty(updatedConfig, 'e2e');
    }

    if (
      !experimentalSkipDomainInjectionProperty ||
      !ts.isArrayLiteralExpression(
        experimentalSkipDomainInjectionProperty.initializer
      ) ||
      !experimentalSkipDomainInjectionProperty.initializer.elements.length
    ) {
      // it's not set or it's set to an empty array, so we set the
      // injectDocumentDomain property to true
      updatedConfig = setInjectDocumentDomainInObjectLiteral(
        updatedConfig,
        e2eProperty
      );
    }
  }

  if (
    componentProperty &&
    ts.isObjectLiteralExpression(componentProperty.initializer)
  ) {
    const experimentalSkipDomainInjectionProperty = getObjectProperty(
      componentProperty.initializer,
      'experimentalSkipDomainInjection'
    );
    if (experimentalSkipDomainInjectionProperty) {
      const updatedComponentProperty = removeObjectProperty(
        componentProperty.initializer,
        experimentalSkipDomainInjectionProperty
      );
      updatedConfig = updateObjectProperty(updatedConfig, componentProperty, {
        newValue: updatedComponentProperty,
      });
      componentProperty = getObjectProperty(updatedConfig, 'component');
    }

    if (
      !experimentalSkipDomainInjectionProperty ||
      !ts.isArrayLiteralExpression(
        experimentalSkipDomainInjectionProperty.initializer
      ) ||
      !experimentalSkipDomainInjectionProperty.initializer.elements.length
    ) {
      // it's not set or it's set to an empty array, so we set the
      // injectDocumentDomain property to true
      updatedConfig = setInjectDocumentDomainInObjectLiteral(
        updatedConfig,
        componentProperty
      );
    }
  }

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(ts.EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}

function setInjectDocumentDomainInObjectLiteral(
  config: ObjectLiteralExpression,
  property?: PropertyAssignment
): ObjectLiteralExpression {
  let configToUpdate: ObjectLiteralExpression;
  let isUpdatingProperty = false;
  if (property && ts.isObjectLiteralExpression(property.initializer)) {
    // if a property is provided and it's an object, update it
    configToUpdate = property.initializer;
    isUpdatingProperty = true;
  } else {
    // if no property is provided or it's not an object, update the top level
    // config object
    configToUpdate = config;
  }

  const updatedObject = ts.factory.updateObjectLiteralExpression(
    configToUpdate,
    ts.factory.createNodeArray([
      ...configToUpdate.properties,
      ts.addSyntheticLeadingComment(
        ts.addSyntheticLeadingComment(
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier('injectDocumentDomain'),
            ts.factory.createTrue()
          ),
          ts.SyntaxKind.SingleLineCommentTrivia,
          ' Please ensure you use `cy.origin()` when navigating between domains and remove this option.'
        ),
        ts.SyntaxKind.SingleLineCommentTrivia,
        ' See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin'
      ),
    ])
  );

  if (isUpdatingProperty) {
    return updateObjectProperty(config, property, {
      newValue: updatedObject,
    });
  }

  return updatedObject;
}
