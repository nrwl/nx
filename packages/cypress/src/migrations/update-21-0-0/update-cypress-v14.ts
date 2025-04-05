import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  visitNotIgnoredFiles,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { lt, valid } from 'semver';
import {
  addSyntheticLeadingComment,
  createPrinter,
  EmitHint,
  factory,
  isBinaryExpression,
  isCallExpression,
  isExportAssignment,
  isExpressionStatement,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  isVariableStatement,
  SyntaxKind,
  type BinaryExpression,
  type ExportAssignment,
  type Expression,
  type ExpressionStatement,
  type Identifier,
  type ImportDeclaration,
  type ObjectLiteralExpression,
  type Printer,
  type PropertyAssignment,
  type SourceFile,
} from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations';

type ComponentTestingInfo = {
  hasComponentTesting: boolean;
  framework?: 'angular' | 'react';
  isLegacyVersion?: boolean;
};

let printer: Printer;
export default async function (tree: Tree) {
  printer = createPrinter();

  const projectGraph = await createProjectGraphAsync();

  for await (const {
    cypressConfigPath,
    projectName,
    projectConfig,
  } of cypressProjectConfigs(tree)) {
    const cypressConfig = tree.read(cypressConfigPath, 'utf-8');

    const ctInfo = parseComponentTestingInfo(
      cypressConfig,
      projectName,
      projectGraph
    );

    let updatedConfig = setInjectDocumentDomain(cypressConfig);
    // https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalSkipDomainInjection%20configuration%20has%20been,injectDocumentDomain%20configuration
    updatedConfig = removeConfigOption(
      updatedConfig,
      'experimentalSkipDomainInjection'
    );
    // https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalFetchPolyfill%20configuration%20option%20was,cy.intercept()%20for%20handling%20fetch%20requests
    updatedConfig = removeConfigOption(
      updatedConfig,
      'experimentalFetchPolyfill'
    );

    if (ctInfo.hasComponentTesting) {
      updatedConfig = updateCtJustInTimeCompile(updatedConfig);

      if (ctInfo.framework === 'angular') {
        migrateAngularFramework(tree, projectConfig, ctInfo.isLegacyVersion);
      } else if (ctInfo.framework === 'react') {
        migrateReactFramework(tree, projectConfig);
      }
    }

    tree.write(cypressConfigPath, updatedConfig);
  }

  await formatFiles(tree);
}

function parseComponentTestingInfo(
  cypressConfig: string,
  projectName: string,
  projectGraph: ProjectGraph
): ComponentTestingInfo {
  const frameworkProperty = tsquery.query<PropertyAssignment>(
    cypressConfig,
    'ObjectLiteralExpression PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=framework])'
  )[0];

  if (!frameworkProperty) {
    // component.devServer.framework is not defined, so it's not using
    // component testing or the config is not valid
    return { hasComponentTesting: false };
  }

  const framework =
    isStringLiteral(frameworkProperty.initializer) &&
    frameworkProperty.initializer.getText().replace(/['"`]/g, '');

  if (framework === 'react') {
    return { hasComponentTesting: true, framework: 'react' };
  }

  if (framework === 'angular') {
    const angularCoreDep = projectGraph.dependencies[projectName].find((d) =>
      // account for possible different versions of angular core
      d.target.startsWith('npm:@angular/core')
    );
    if (angularCoreDep) {
      const angularVersion =
        projectGraph.externalNodes?.[angularCoreDep.target]?.data?.version;
      if (valid(angularVersion) && lt(angularVersion, '17.2.0')) {
        return {
          hasComponentTesting: true,
          framework: 'angular',
          isLegacyVersion: true,
        };
      }
    }

    return {
      hasComponentTesting: true,
      framework: 'angular',
      isLegacyVersion: false,
    };
  }

  return { hasComponentTesting: true };
}

// https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin
function setInjectDocumentDomain(cypressConfig: string): string {
  const sourceFile = tsquery.ast(cypressConfig);
  const config = resolveCypressConfigObject(sourceFile);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  const e2eProperty = getObjectProperty(config, 'e2e');
  const componentProperty = getObjectProperty(config, 'component');
  let updatedConfig: ObjectLiteralExpression;

  if ((!e2eProperty && !componentProperty) || config.properties.length > 1) {
    // if both are missing or there are more than one property, add the
    // injectDocumentDomain property to the top level config object
    updatedConfig = setInjectDocumentDomainInObjectLiteral(config);
  } else if (e2eProperty) {
    // if only e2e is defined, try to update it
    updatedConfig = setInjectDocumentDomainInObjectLiteral(config, e2eProperty);
  } else if (componentProperty) {
    // if only component is defined, try to update it
    updatedConfig = setInjectDocumentDomainInObjectLiteral(
      config,
      componentProperty
    );
  }

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}

function setInjectDocumentDomainInObjectLiteral(
  config: ObjectLiteralExpression,
  property?: PropertyAssignment
): ObjectLiteralExpression {
  let configToUpdate: ObjectLiteralExpression;
  let isUpdatingProperty = false;
  if (property && isObjectLiteralExpression(property.initializer)) {
    // if a property is provided and it's an object, update it
    configToUpdate = property.initializer;
    isUpdatingProperty = true;
  } else {
    // if no property is provided or it's not an object, update the top level
    // config object
    configToUpdate = config;
  }

  const updatedObject = factory.updateObjectLiteralExpression(
    configToUpdate,
    factory.createNodeArray([
      ...configToUpdate.properties,
      addSyntheticLeadingComment(
        factory.createPropertyAssignment(
          factory.createIdentifier('injectDocumentDomain'),
          factory.createTrue()
        ),
        SyntaxKind.SingleLineCommentTrivia,
        ' See https://docs.cypress.io/app/references/migration-guide#Changes-to-cyorigin'
      ),
    ])
  );

  if (isUpdatingProperty) {
    return factory.updateObjectLiteralExpression(
      config,
      config.properties.map((p) =>
        p === property
          ? factory.updatePropertyAssignment(p, p.name, updatedObject)
          : p
      )
    );
  }

  return updatedObject;
}

function removeConfigOption(cypressConfig: string, optionName: string): string {
  const sourceFile = tsquery.ast(cypressConfig);
  const config = resolveCypressConfigObject(sourceFile);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  const updatedConfig = factory.updateObjectLiteralExpression(
    config,
    config.properties
      // remove the experimentalSkipDomainInjection property from the top level config object
      .filter(
        (p) => !isPropertyAssignment(p) || p.name.getText() !== optionName
      )
      .map((p) => {
        if (
          isPropertyAssignment(p) &&
          ['component', 'e2e'].includes(p.name.getText()) &&
          isObjectLiteralExpression(p.initializer)
        ) {
          // remove the property with the given name from the component or e2e config object
          return factory.updatePropertyAssignment(
            p,
            p.name,
            factory.updateObjectLiteralExpression(
              p.initializer,
              p.initializer.properties.filter(
                (ip) =>
                  !isPropertyAssignment(ip) || ip.name.getText() !== optionName
              )
            )
          );
        }

        return p;
      })
  );

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}

// https://docs.cypress.io/app/references/migration-guide#CT-Just-in-Time-Compile-changes
function updateCtJustInTimeCompile(cypressConfig: string): string {
  const sourceFile = tsquery.ast(cypressConfig);
  const config = resolveCypressConfigObject(sourceFile);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  let updatedConfig = config;

  const bundlerProperty = tsquery.query<PropertyAssignment>(
    updatedConfig,
    'ObjectLiteralExpression PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=bundler])'
  )[0];
  const isViteBundler =
    bundlerProperty &&
    isStringLiteral(bundlerProperty.initializer) &&
    bundlerProperty.initializer.getText().replace(/['"`]/g, '') === 'vite';

  const existingJustInTimeCompileProperty = getObjectProperty(
    updatedConfig,
    'experimentalJustInTimeCompile'
  );
  if (existingJustInTimeCompileProperty) {
    if (
      isViteBundler ||
      existingJustInTimeCompileProperty.initializer.kind ===
        SyntaxKind.TrueKeyword
    ) {
      // if it's using vite or it's set to true (the new default value), remove it
      updatedConfig = factory.updateObjectLiteralExpression(
        updatedConfig,
        updatedConfig.properties.filter(
          (p) => p !== existingJustInTimeCompileProperty
        )
      );
    } else {
      // rename to justInTimeCompile
      updatedConfig = factory.updateObjectLiteralExpression(
        updatedConfig,
        updatedConfig.properties.map((p) =>
          p === existingJustInTimeCompileProperty
            ? factory.updatePropertyAssignment(
                p,
                factory.createIdentifier('justInTimeCompile'),
                p.initializer
              )
            : p
        )
      );
    }
  }

  const componentProperty = getObjectProperty(updatedConfig, 'component');
  if (
    componentProperty &&
    isObjectLiteralExpression(componentProperty.initializer)
  ) {
    const componentConfigObject = componentProperty.initializer;
    const existingJustInTimeCompileProperty = getObjectProperty(
      componentConfigObject,
      'experimentalJustInTimeCompile'
    );
    if (existingJustInTimeCompileProperty) {
      if (
        isViteBundler ||
        existingJustInTimeCompileProperty.initializer.kind ===
          SyntaxKind.TrueKeyword
      ) {
        // if it's using vite or it's set to true (the new default value), remove it
        updatedConfig = factory.updateObjectLiteralExpression(
          updatedConfig,
          updatedConfig.properties.map((p) =>
            p === componentProperty
              ? factory.updatePropertyAssignment(
                  p,
                  p.name,
                  factory.updateObjectLiteralExpression(
                    componentConfigObject,
                    componentConfigObject.properties.filter(
                      (p) => p !== existingJustInTimeCompileProperty
                    )
                  )
                )
              : p
          )
        );
      } else {
        // rename to justInTimeCompile
        updatedConfig = factory.updateObjectLiteralExpression(
          updatedConfig,
          updatedConfig.properties.map((p) =>
            p === componentProperty
              ? factory.updatePropertyAssignment(
                  p,
                  p.name,
                  factory.updateObjectLiteralExpression(
                    componentConfigObject,
                    componentConfigObject.properties.map((p) =>
                      p === existingJustInTimeCompileProperty
                        ? factory.updatePropertyAssignment(
                            p,
                            factory.createIdentifier('justInTimeCompile'),
                            p.initializer
                          )
                        : p
                    )
                  )
                )
              : p
          )
        );
      }
    }
  }

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}

// https://docs.cypress.io/app/references/migration-guide#Angular-1720-CT-no-longer-supported
function migrateAngularFramework(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  isLegacyVersion: boolean
) {
  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    let updatedFileContent: string;
    if (isLegacyVersion) {
      let needPackage = false;

      updatedFileContent = tsquery.replace(
        content,
        'ImportDeclaration',
        importTransformerFactory(
          content,
          'cypress/angular',
          '@cypress/angular',
          () => {
            needPackage = true;
          }
        )
      );

      if (needPackage) {
        addDependenciesToPackageJson(
          tree,
          {},
          { '@cypress/angular': '^2.1.0' },
          undefined,
          true
        );
      }
    } else {
      updatedFileContent = tsquery.replace(
        content,
        'ImportDeclaration',
        importTransformerFactory(
          content,
          'cypress/angular-signals',
          'cypress/angular'
        )
      );
    }

    tree.write(filePath, updatedFileContent);
  });
}

// https://docs.cypress.io/app/references/migration-guide#React-18-CT-no-longer-supported
function migrateReactFramework(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');
    const updatedContent = tsquery.replace(
      content,
      'ImportDeclaration',
      importTransformerFactory(content, 'cypress/react18', 'cypress/react')
    );

    tree.write(filePath, updatedContent);
  });
}

function importTransformerFactory(
  fileContent: string,
  sourceModuleSpecifier: string,
  targetModuleSpecifier: string,
  matchImportCallback?: () => void
): Parameters<typeof tsquery.replace>[2] {
  return (node: ImportDeclaration) => {
    if (
      node.moduleSpecifier.getText().replace(/['"`]/g, '') ===
      sourceModuleSpecifier
    ) {
      matchImportCallback?.();
      const updatedImport = factory.updateImportDeclaration(
        node,
        node.modifiers,
        node.importClause,
        factory.createStringLiteral(targetModuleSpecifier),
        node.attributes
      );

      return printer.printNode(
        EmitHint.Unspecified,
        updatedImport,
        tsquery.ast(fileContent)
      );
    }

    return node.getText();
  };
}

function isJsTsFile(filePath: string) {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}

export function resolveCypressConfigObject(
  cypressConfigSourceFile: SourceFile
): ObjectLiteralExpression | null {
  const exportDefaultStatement = cypressConfigSourceFile.statements.find(
    (statement): statement is ExportAssignment => isExportAssignment(statement)
  );

  if (exportDefaultStatement) {
    return resolveCypressConfigObjectFromExportExpression(
      exportDefaultStatement.expression,
      cypressConfigSourceFile
    );
  }

  const moduleExportsStatement = cypressConfigSourceFile.statements.find(
    (
      statement
    ): statement is ExpressionStatement & { expression: BinaryExpression } =>
      isExpressionStatement(statement) &&
      isBinaryExpression(statement.expression) &&
      statement.expression.left.getText() === 'module.exports'
  );

  if (moduleExportsStatement) {
    return resolveCypressConfigObjectFromExportExpression(
      moduleExportsStatement.expression.right,
      cypressConfigSourceFile
    );
  }

  return null;
}

function resolveCypressConfigObjectFromExportExpression(
  exportExpression: Expression,
  sourceFile: SourceFile
): ObjectLiteralExpression | null {
  if (isObjectLiteralExpression(exportExpression)) {
    return exportExpression;
  }

  if (isIdentifier(exportExpression)) {
    // try to locate the identifier in the source file
    const variableStatements = sourceFile.statements.filter((statement) =>
      isVariableStatement(statement)
    );

    for (const variableStatement of variableStatements) {
      for (const declaration of variableStatement.declarationList
        .declarations) {
        if (
          isIdentifier(declaration.name) &&
          declaration.name.getText() === exportExpression.getText() &&
          isObjectLiteralExpression(declaration.initializer)
        ) {
          return declaration.initializer;
        }
      }
    }

    return null;
  }

  if (
    isCallExpression(exportExpression) &&
    isIdentifier(exportExpression.expression) &&
    exportExpression.expression.getText() === 'defineConfig' &&
    isObjectLiteralExpression(exportExpression.arguments[0])
  ) {
    return exportExpression.arguments[0];
  }

  return null;
}

function getObjectProperty(
  config: ObjectLiteralExpression,
  name: string
): PropertyAssignment | undefined {
  return config.properties.find(
    (p): p is PropertyAssignment =>
      isPropertyAssignment(p) && p.name.getText() === name
  );
}
