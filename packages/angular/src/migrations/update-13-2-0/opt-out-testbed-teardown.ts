import {
  formatFiles,
  getProjects,
  logger,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { dirname, extname } from 'path';
import * as ts from 'typescript';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects.entries()) {
    // only interested in projects with @nrwl/jest:jest executor
    if (project.targets?.test?.executor !== '@nrwl/jest:jest') {
      continue;
    }

    const jestConfigPath = project.targets.test.options?.jestConfig;
    // if there's not jestConfigPath, we don't process it
    if (!jestConfigPath) {
      logger.warn(
        `The "jestConfig" property is not configured for the test target of the project "${projectName}". Skipping it.`
      );
      continue;
    }

    if (!tree.exists(jestConfigPath)) {
      logger.warn(
        `The specified "jestConfig" path "${jestConfigPath}" for the project "${projectName}" can not be found. Skipping it.`
      );
      continue;
    }

    let jestConfigContents = tree.read(jestConfigPath, 'utf-8');
    // check if it's an angular project by looking for jest-preset-angular
    if (!jestConfigContents.includes('jest-preset-angular')) {
      continue;
    }

    const { shouldUpdate, testSetupFilePath } = shouldUpdateTeardownConfig(
      tree,
      projectName,
      jestConfigPath,
      jestConfigContents
    );

    if (!shouldUpdate) {
      continue;
    }

    const printer = ts.createPrinter();
    if (shouldUpdate === 'testSetup') {
      optOutTestTeardownFromTestSetupFile(tree, testSetupFilePath, printer);
    } else {
      optOutTestTeardownFromTestFiles(tree, projectName, printer);
    }
  }

  await formatFiles(tree);
}

function shouldUpdateTeardownConfig(
  tree: Tree,
  projectName: string,
  jestConfigPath: string,
  jestConfigContents: string
): {
  shouldUpdate: 'testFiles' | 'testSetup' | false;
  testSetupFilePath?: string;
} {
  const jestConfigAst = tsquery.ast(jestConfigContents);
  const setupFilesAfterEnvSelector =
    'PropertyAssignment:has(Identifier[name=setupFilesAfterEnv])';
  const setupFilesAfterEnvProperty = tsquery(
    jestConfigAst,
    setupFilesAfterEnvSelector,
    {
      visitAllChildren: true,
    }
  )[0] as ts.PropertyAssignment;

  // no property specified, we try to migrate test files
  if (!setupFilesAfterEnvProperty) {
    return { shouldUpdate: 'testFiles' };
  }

  const setupFilesValueSelector = 'ArrayLiteralExpression StringLiteral';
  const setupFilesValue = tsquery(
    setupFilesAfterEnvProperty,
    setupFilesValueSelector,
    {
      visitAllChildren: true,
    }
  )[0] as ts.StringLiteral;

  // not setup file specified, we try to migrate test files
  if (!setupFilesValue) {
    return { shouldUpdate: 'testFiles' };
  }

  const testSetupFilePath = setupFilesValue
    .getText()
    .replace('<rootDir>', dirname(jestConfigPath))
    .replace(/['"]/g, '');

  // the specified file is invalid, we migrate test files
  if (!tree.exists(testSetupFilePath)) {
    return { shouldUpdate: 'testFiles' };
  }

  let testSetupFileContents = tree.read(testSetupFilePath, 'utf-8');
  const testSetupFileAst = tsquery.ast(testSetupFileContents);

  const initTestEnvironmentSelector =
    'CallExpression:has(PropertyAccessExpression:has(Identifier[name=initTestEnvironment]))';
  const initTestEnvironmentCall = tsquery(
    testSetupFileAst,
    initTestEnvironmentSelector,
    {
      visitAllChildren: true,
    }
  )[0] as ts.CallExpression;

  // no initTestEnvironment call, we migrate the test setup file
  if (!initTestEnvironmentCall) {
    return { shouldUpdate: 'testSetup', testSetupFilePath };
  }

  // no third arg, we migrate the test setup file
  if (initTestEnvironmentCall.arguments.length === 2) {
    return { shouldUpdate: 'testSetup', testSetupFilePath };
  }

  // this would be a type error, we migrate test files
  if (initTestEnvironmentCall.arguments.length < 2) {
    return { shouldUpdate: 'testFiles' };
  }

  const optionsArg = initTestEnvironmentCall.arguments[2];

  // the options arg is an object that has a teardown property, no migration is needed
  if (isObjectLiteralWithTeardown(optionsArg)) {
    return { shouldUpdate: false };
  }

  // the options arg is an object that doesn't have a teardown property, we migrate the test setup file
  if (isObjectLiteralWithoutTeardown(optionsArg)) {
    return { shouldUpdate: 'testSetup', testSetupFilePath };
  }

  // the options arg is an `aotSummaries` function, we migrate the test setup file
  if (isFunction(optionsArg)) {
    return { shouldUpdate: 'testSetup', testSetupFilePath };
  }

  // we fallback to migrate the test files
  return { shouldUpdate: 'testFiles' };
}

function optOutTestTeardownFromTestFiles(
  tree: Tree,
  projectName: string,
  printer: ts.Printer
) {
  const { sourceRoot, root } = readProjectConfiguration(tree, projectName);

  visitNotIgnoredFiles(tree, sourceRoot ?? root, (path) => {
    if (!['.ts', '.js'].includes(extname(path))) {
      return;
    }

    let fileContents = tree.read(path, 'utf-8');
    const ast = tsquery.ast(fileContents);

    const configureTestingModulePropertyAccessExpressionSelector =
      'CallExpression > PropertyAccessExpression:has(Identifier[name=configureTestingModule])';
    const configureTestingModulePropertyAccessExpressions = tsquery(
      ast,
      configureTestingModulePropertyAccessExpressionSelector,
      {
        visitAllChildren: true,
      }
    ) as ts.PropertyAccessExpression[];

    // no calls to configureTestingModule, we skip it
    if (!configureTestingModulePropertyAccessExpressions.length) {
      return;
    }

    // reverse the order to not mess with positions as we update the AST
    const reversedConfigureTestingModulePropertyAccessExpressions =
      sortInReverseSourceOrder(configureTestingModulePropertyAccessExpressions);

    reversedConfigureTestingModulePropertyAccessExpressions.forEach(
      (propertyAccessExpression) => {
        const configureTestingModuleCall =
          propertyAccessExpression.parent as ts.CallExpression;

        if (
          configureTestingModuleCall.arguments.length === 0 ||
          !isObjectLiteralWithoutTeardown(
            configureTestingModuleCall.arguments[0]
          )
        ) {
          return;
        }

        const testModuleMetadata = configureTestingModuleCall.arguments[0];

        const replacement = getTestModuleMetadataLiteralReplacement(
          testModuleMetadata,
          printer
        );

        fileContents = `${fileContents.slice(
          0,
          testModuleMetadata.getStart()
        )}${replacement}${fileContents.slice(testModuleMetadata.getEnd())}`;

        tree.write(path, fileContents);
      }
    );
  });
}

function optOutTestTeardownFromTestSetupFile(
  tree: Tree,
  testSetupFilePath: string,
  printer: ts.Printer
) {
  let testSetupFileContents = tree.read(testSetupFilePath, 'utf-8');
  const testSetupFileAst = tsquery.ast(testSetupFileContents);

  const initTestEnvironmentSelector =
    'CallExpression:has(PropertyAccessExpression:has(Identifier[name=initTestEnvironment]))';
  const initTestEnvironmentCall = tsquery(
    testSetupFileAst,
    initTestEnvironmentSelector,
    {
      visitAllChildren: true,
    }
  )[0] as ts.CallExpression;

  if (!initTestEnvironmentCall) {
    testSetupFileContents += `
      import { getTestBed } from '@angular/core/testing';
      import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

      getTestBed().resetTestEnvironment();
      getTestBed().initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting(),
        { teardown: { destroyAfterEach: false } },
      );
    `;

    tree.write(testSetupFilePath, testSetupFileContents);

    return;
  }

  const { span, text } = getInitTestEnvironmentLiteralReplacement(
    initTestEnvironmentCall,
    printer
  );

  testSetupFileContents = `${testSetupFileContents.slice(
    0,
    span.start
  )}${text}${testSetupFileContents.slice(span.end)}`;

  tree.write(testSetupFilePath, testSetupFileContents);
}

function getInitTestEnvironmentLiteralReplacement(
  initTestEnvironmentCall: ts.CallExpression,
  printer: ts.Printer
) {
  const literalProperties: ts.ObjectLiteralElementLike[] = [];
  const options =
    initTestEnvironmentCall.arguments[
      initTestEnvironmentCall.arguments.length - 1
    ];
  let span: { start: number; end: number };
  let prefix: string;

  // update the last argument of the initTestEnvironment call
  if (initTestEnvironmentCall.arguments.length === 3) {
    if (isFunction(options)) {
      // If the last argument is a function, add the function as the `aotSummaries` property.
      literalProperties.push(
        ts.factory.createPropertyAssignment('aotSummaries', options)
      );
    } else if (ts.isObjectLiteralExpression(options)) {
      // If the property is an object literal, copy over all the properties.
      literalProperties.push(...options.properties);
    }

    prefix = '';
    span = {
      start: options.getStart(),
      end: options.getEnd(),
    };
  } else {
    const start = options.getEnd();
    prefix = ', ';
    span = { start, end: start };
  }

  // finally push the teardown object so that it appears last
  literalProperties.push(createTeardownAssignment());

  return {
    span,
    text: `${prefix}${printer.printNode(
      ts.EmitHint.Unspecified,
      ts.factory.createObjectLiteralExpression(literalProperties),
      initTestEnvironmentCall.getSourceFile()
    )}`,
  };
}

function getTestModuleMetadataLiteralReplacement(
  testModuleMetadataObjectLiteral: ts.ObjectLiteralExpression,
  printer: ts.Printer
) {
  return printer.printNode(
    ts.EmitHint.Unspecified,
    ts.factory.createObjectLiteralExpression(
      [
        ...testModuleMetadataObjectLiteral.properties,
        createTeardownAssignment(),
      ],
      testModuleMetadataObjectLiteral.properties.length > 0
    ),
    testModuleMetadataObjectLiteral.getSourceFile()
  );
}

function isObjectLiteralWithTeardown(
  node: ts.Node
): node is ts.ObjectLiteralExpression {
  return (
    ts.isObjectLiteralExpression(node) &&
    node.properties.some((prop) => {
      return prop.name?.getText() === 'teardown';
    })
  );
}

function isObjectLiteralWithoutTeardown(
  node: ts.Node
): node is ts.ObjectLiteralExpression {
  return (
    ts.isObjectLiteralExpression(node) &&
    !node.properties.find((prop) => {
      return prop.name?.getText() === 'teardown';
    })
  );
}

function isFunction(
  node: ts.Node
): node is ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node)
  );
}

function createTeardownAssignment(): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(
    'teardown',
    ts.factory.createObjectLiteralExpression([
      ts.factory.createPropertyAssignment(
        'destroyAfterEach',
        ts.factory.createFalse()
      ),
    ])
  );
}

function sortInReverseSourceOrder<T extends ts.Node>(nodes: T[]): T[] {
  return nodes.sort((a, b) => b.getEnd() - a.getEnd());
}
