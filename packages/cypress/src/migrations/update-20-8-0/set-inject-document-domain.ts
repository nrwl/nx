import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type {
  Expression,
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
  let hasOtherTopLevelProperties = config.properties.some(
    (p): p is PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      p.name.getText() !== 'e2e' &&
      p.name.getText() !== 'component'
  );
  let updatedConfig = config;

  const topLevelExperimentalSkipDomainInjectionProperty = getObjectProperty(
    updatedConfig,
    'experimentalSkipDomainInjection'
  );
  const topLevelSkipDomainState: 'not-set' | 'skipping' | 'not-skipping' =
    !topLevelExperimentalSkipDomainInjectionProperty
      ? 'not-set'
      : !ts.isArrayLiteralExpression(
          topLevelExperimentalSkipDomainInjectionProperty.initializer
        ) ||
        topLevelExperimentalSkipDomainInjectionProperty.initializer.elements
          .length > 0
      ? 'skipping'
      : 'not-skipping';

  let e2eSkipDomainState: 'not-set' | 'skipping' | 'not-skipping' = 'not-set';
  if (e2eProperty) {
    let experimentalSkipDomainInjectionProperty: PropertyAssignment | undefined;
    let isObjectLiteral = false;
    if (ts.isObjectLiteralExpression(e2eProperty.initializer)) {
      experimentalSkipDomainInjectionProperty = getObjectProperty(
        e2eProperty.initializer,
        'experimentalSkipDomainInjection'
      );
      isObjectLiteral = true;
    }

    if (experimentalSkipDomainInjectionProperty) {
      e2eSkipDomainState =
        !ts.isArrayLiteralExpression(
          experimentalSkipDomainInjectionProperty.initializer
        ) ||
        experimentalSkipDomainInjectionProperty.initializer.elements.length > 0
          ? 'skipping'
          : 'not-skipping';
    }

    if (
      e2eSkipDomainState === 'not-set' &&
      topLevelSkipDomainState === 'not-set'
    ) {
      updatedConfig = updateObjectProperty(updatedConfig, e2eProperty, {
        newValue: setInjectDocumentDomainInObject(e2eProperty.initializer),
      });
    } else if (e2eSkipDomainState === 'not-skipping') {
      updatedConfig = updateObjectProperty(updatedConfig, e2eProperty, {
        newValue: replaceExperimentalSkipDomainInjectionInObject(
          e2eProperty.initializer
        ),
      });
    } else if (e2eSkipDomainState === 'skipping') {
      updatedConfig = updateObjectProperty(updatedConfig, e2eProperty, {
        newValue: removeObjectProperty(
          // we only determine that it's skipping if it's an object literal
          e2eProperty.initializer as ObjectLiteralExpression,
          getObjectProperty(
            e2eProperty.initializer as ObjectLiteralExpression,
            'experimentalSkipDomainInjection'
          )
        ),
      });
    }
  }

  if (
    topLevelSkipDomainState === 'not-set' &&
    !e2eProperty &&
    hasOtherTopLevelProperties
  ) {
    updatedConfig = setInjectDocumentDomainInObject(updatedConfig);
  } else if (topLevelSkipDomainState === 'not-skipping') {
    updatedConfig =
      replaceExperimentalSkipDomainInjectionInObject(updatedConfig);
  } else if (topLevelSkipDomainState === 'skipping') {
    updatedConfig = removeObjectProperty(
      updatedConfig,
      topLevelExperimentalSkipDomainInjectionProperty
    );
  }

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(ts.EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}

function setInjectDocumentDomainInObject(
  config: Expression
): ObjectLiteralExpression {
  let configToUpdate: ObjectLiteralExpression;
  if (ts.isObjectLiteralExpression(config)) {
    configToUpdate = config;
  } else {
    // spread the current expression into a new object literal
    configToUpdate = ts.factory.createObjectLiteralExpression([
      ts.factory.createSpreadAssignment(config),
    ]);
  }

  return ts.factory.updateObjectLiteralExpression(
    configToUpdate,
    ts.factory.createNodeArray([
      ...configToUpdate.properties,
      getInjectDocumentDomainPropertyAssignment(),
    ])
  );
}

function replaceExperimentalSkipDomainInjectionInObject(
  config: Expression
): ObjectLiteralExpression {
  let configToUpdate: ObjectLiteralExpression;
  if (ts.isObjectLiteralExpression(config)) {
    configToUpdate = config;
  } else {
    // spread the current expression into a new object literal
    configToUpdate = ts.factory.createObjectLiteralExpression([
      ts.factory.createSpreadAssignment(config),
    ]);
  }

  return ts.factory.updateObjectLiteralExpression(
    configToUpdate,
    configToUpdate.properties.map((property) =>
      property.name?.getText() === 'experimentalSkipDomainInjection'
        ? getInjectDocumentDomainPropertyAssignment()
        : property
    )
  );
}

function getInjectDocumentDomainPropertyAssignment(): PropertyAssignment {
  return ts.addSyntheticLeadingComment(
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
  );
}
