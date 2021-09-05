import * as ts from 'typescript';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import {
  ChangeType,
  logger,
  StringChange,
  StringInsertion,
} from '@nrwl/devkit';

export function addImport(
  source: ts.SourceFile,
  statement: string
): StringChange[] {
  const allImports = findNodes(source, ts.SyntaxKind.ImportDeclaration);
  if (allImports.length > 0) {
    const lastImport = allImports[allImports.length - 1];
    return [
      {
        type: ChangeType.Insert,
        index: lastImport.end + 1,
        text: `\n${statement}\n`,
      },
    ];
  } else {
    return [
      {
        type: ChangeType.Insert,
        index: 0,
        text: `\n${statement}\n`,
      },
    ];
  }
}

export function findMainRenderStatement(
  source: ts.SourceFile
): ts.CallExpression | null {
  // 1. Try to find ReactDOM.render.
  const calls = findNodes(
    source,
    ts.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  for (const expr of calls) {
    const inner = expr.expression;
    if (
      ts.isPropertyAccessExpression(inner) &&
      /ReactDOM/i.test(inner.expression.getText()) &&
      inner.name.getText() === 'render'
    ) {
      return expr;
    }
  }

  // 2. Try to find render from 'react-dom'.
  const imports = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];
  const hasRenderImport = imports.some(
    (i) =>
      i.moduleSpecifier.getText().includes('react-dom') &&
      /\brender\b/.test(i.importClause.namedBindings.getText())
  );
  if (hasRenderImport) {
    const calls = findNodes(
      source,
      ts.SyntaxKind.CallExpression
    ) as ts.CallExpression[];
    for (const expr of calls) {
      if (expr.expression.getText() === 'render') {
        return expr;
      }
    }
  }

  return null;
}

export function findDefaultExport(source: ts.SourceFile): ts.Node | null {
  return (
    findDefaultExportDeclaration(source) || findDefaultClassOrFunction(source)
  );
}

export function findDefaultExportDeclaration(
  source: ts.SourceFile
): ts.Node | null {
  const identifier = findDefaultExportIdentifier(source);

  if (identifier) {
    const variables = findNodes(source, ts.SyntaxKind.VariableDeclaration);
    const fns = findNodes(source, ts.SyntaxKind.FunctionDeclaration);
    const cls = findNodes(source, ts.SyntaxKind.ClassDeclaration);
    const all = [...variables, ...fns, ...cls] as Array<
      ts.VariableDeclaration | ts.FunctionDeclaration | ts.ClassDeclaration
    >;

    const exported = all
      .filter((x) => x.name.kind === ts.SyntaxKind.Identifier)
      .find((x) => (x.name as ts.Identifier).text === identifier.text);

    return exported || null;
  } else {
    return null;
  }
}

export function findDefaultExportIdentifier(
  source: ts.SourceFile
): ts.Identifier | null {
  const exports = findNodes(
    source,
    ts.SyntaxKind.ExportAssignment
  ) as ts.ExportAssignment[];

  const identifier = exports
    .map((x) => x.expression)
    .find((x) => x.kind === ts.SyntaxKind.Identifier) as ts.Identifier;

  return identifier || null;
}

export function findDefaultClassOrFunction(
  source: ts.SourceFile
): ts.FunctionDeclaration | ts.ClassDeclaration | null {
  const fns = findNodes(
    source,
    ts.SyntaxKind.FunctionDeclaration
  ) as ts.FunctionDeclaration[];
  const cls = findNodes(
    source,
    ts.SyntaxKind.ClassDeclaration
  ) as ts.ClassDeclaration[];

  return (
    fns.find(hasDefaultExportModifier) ||
    cls.find(hasDefaultExportModifier) ||
    null
  );
}

function hasDefaultExportModifier(
  x: ts.ClassDeclaration | ts.FunctionDeclaration
) {
  return (
    x.modifiers &&
    x.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
    x.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
  );
}

export function findComponentImportPath(
  componentName: string,
  source: ts.SourceFile
) {
  const allImports = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];
  const matching = allImports.filter((i: ts.ImportDeclaration) => {
    return (
      i.importClause &&
      i.importClause.name &&
      i.importClause.name.getText() === componentName
    );
  });

  if (matching.length === 0) {
    return null;
  }

  const appImport = matching[0];
  return appImport.moduleSpecifier.getText().replace(/['"]/g, '');
}

export function findElements(source: ts.SourceFile, tagName: string) {
  const nodes = findNodes(source, [
    ts.SyntaxKind.JsxSelfClosingElement,
    ts.SyntaxKind.JsxOpeningElement,
  ]);
  return nodes.filter((node) => isTag(tagName, node));
}

export function findClosestOpening(tagName: string, node: ts.Node) {
  if (!node) {
    return null;
  }

  if (isTag(tagName, node)) {
    return node;
  } else {
    return findClosestOpening(tagName, node.parent);
  }
}

export function isTag(tagName: string, node: ts.Node) {
  if (ts.isJsxOpeningLikeElement(node)) {
    return (
      node.tagName.kind === ts.SyntaxKind.Identifier &&
      node.tagName.text === tagName
    );
  }

  if (ts.isJsxElement(node) && node.openingElement) {
    return (
      node.openingElement.tagName.kind === ts.SyntaxKind.Identifier &&
      node.openingElement.tagName.getText() === tagName
    );
  }

  return false;
}

export function addInitialRoutes(
  sourcePath: string,
  source: ts.SourceFile
): StringChange[] {
  const jsxClosingElements = findNodes(source, [
    ts.SyntaxKind.JsxClosingElement,
    ts.SyntaxKind.JsxClosingFragment,
  ]);
  const outerMostJsxClosing = jsxClosingElements[jsxClosingElements.length - 1];

  if (!outerMostJsxClosing) {
    logger.warn(
      `Could not find JSX elements in ${sourcePath}; Skipping insert routes`
    );
    return [];
  }

  const insertRoutes: StringInsertion = {
    type: ChangeType.Insert,
    index: outerMostJsxClosing.getStart(),
    text: `
    {/* START: routes */}
    {/* These routes and navigation have been generated for you */}
    {/* Feel free to move and update them to fit your needs */}
    <br/>
    <hr/>
    <br/>
    <div role="navigation">
      <ul>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/page-2">Page 2</Link></li>
      </ul>
    </div>
    <Route
      path="/"
      exact
      render={() => (
        <div>This is the generated root route. <Link to="/page-2">Click here for page 2.</Link></div>
      )}
    />
    <Route
      path="/page-2"
      exact
      render={() => (
        <div><Link to="/">Click here to go back to root page.</Link></div>
      )}
    />
    {/* END: routes */}
    `,
  };

  return [
    ...addImport(source, `import { Route, Link } from 'react-router-dom';`),
    insertRoutes,
  ];
}

export function addRoute(
  sourcePath: string,
  source: ts.SourceFile,
  options: {
    routePath: string;
    componentName: string;
    moduleName: string;
  }
): StringChange[] {
  const routes = findElements(source, 'Route');
  const links = findElements(source, 'Link');

  if (routes.length === 0) {
    logger.warn(
      `Could not find <Route/> components in ${sourcePath}; Skipping add route`
    );
    return [];
  } else {
    const changes: StringChange[] = [];
    const firstRoute = routes[0];
    const firstLink = links[0];

    changes.push(
      ...addImport(
        source,
        `import { ${options.componentName} } from '${options.moduleName}';`
      )
    );

    changes.push({
      type: ChangeType.Insert,
      index: firstRoute.getEnd(),
      text: `<Route path="${options.routePath}" component={${options.componentName}} />`,
    });

    if (firstLink) {
      const parentLi = findClosestOpening('li', firstLink);
      if (parentLi) {
        changes.push({
          type: ChangeType.Insert,
          index: parentLi.getEnd(),
          text: `<li><Link to="${options.routePath}">${options.componentName}</Link></li>`,
        });
      } else {
        changes.push({
          type: ChangeType.Insert,
          index: firstLink.parent.getEnd(),
          text: `<Link to="${options.routePath}">${options.componentName}</Link>`,
        });
      }
    }

    return changes;
  }
}

export function addBrowserRouter(
  sourcePath: string,
  source: ts.SourceFile
): StringChange[] {
  const app = findElements(source, 'App')[0];
  if (app) {
    return [
      ...addImport(source, `import { BrowserRouter } from 'react-router-dom';`),
      {
        type: ChangeType.Insert,
        index: app.getStart(),
        text: `<BrowserRouter>`,
      },
      {
        type: ChangeType.Insert,
        index: app.getEnd(),
        text: `</BrowserRouter>`,
      },
    ];
  } else {
    logger.warn(
      `Could not find App component in ${sourcePath}; Skipping add <BrowserRouter>`
    );
    return [];
  }
}

export function addReduxStoreToMain(
  sourcePath: string,
  source: ts.SourceFile
): StringChange[] {
  const renderStmt = findMainRenderStatement(source);
  if (!renderStmt) {
    logger.warn(`Could not find ReactDOM.render in ${sourcePath}`);
    return [];
  }
  const jsx = renderStmt.arguments[0];
  return [
    ...addImport(
      source,
      `import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';`
    ),
    {
      type: ChangeType.Insert,
      index: renderStmt.getStart(),
      text: `
const store = configureStore({
  reducer: {},
  // Additional middleware can be passed to this array
  middleware: getDefaultMiddleware => getDefaultMiddleware(),
  devTools: process.env.NODE_ENV !== 'production',
  // Optional Redux store enhancers
  enhancers: [],
});

`,
    },
    {
      type: ChangeType.Insert,
      index: jsx.getStart(),
      text: `<Provider store={store}>`,
    },
    {
      type: ChangeType.Insert,
      index: jsx.getEnd(),
      text: `</Provider>`,
    },
  ];
}

export function updateReduxStore(
  sourcePath: string,
  source: ts.SourceFile,
  feature: {
    keyName: string;
    reducerName: string;
    modulePath: string;
  }
): StringChange[] {
  const calls = findNodes(
    source,
    ts.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  let reducerDescriptor: ts.ObjectLiteralExpression;
  // Look for configureStore call
  for (const expr of calls) {
    if (!expr.expression.getText().includes('configureStore')) {
      continue;
    }
    const arg = expr.arguments[0];
    if (ts.isObjectLiteralExpression(arg)) {
      let found: ts.ObjectLiteralExpression;
      for (const prop of arg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          prop.name.getText() === 'reducer' &&
          ts.isObjectLiteralExpression(prop.initializer)
        ) {
          found = prop.initializer;
          break;
        }
      }
      if (found) {
        reducerDescriptor = found;
        break;
      }
    }
  }
  // Look for combineReducer call
  if (!reducerDescriptor) {
    for (const expr of calls) {
      if (!expr.expression.getText().includes('combineReducer')) {
        continue;
      }
      const arg = expr.arguments[0];
      if (ts.isObjectLiteralExpression(arg)) {
        reducerDescriptor = arg;
        break;
      }
    }
  }

  if (!reducerDescriptor) {
    logger.warn(
      `Could not find configureStore/combineReducer call in ${sourcePath}`
    );
    return [];
  }

  return [
    ...addImport(
      source,
      `import { ${feature.keyName}, ${feature.reducerName} } from '${feature.modulePath}';`
    ),
    {
      type: ChangeType.Insert,
      index: reducerDescriptor.getStart() + 1,
      text: `[${feature.keyName}]: ${feature.reducerName}${
        reducerDescriptor.properties.length > 0 ? ',' : ''
      }`,
    },
  ];
}

export function getComponentName(sourceFile: ts.SourceFile): ts.Node | null {
  const defaultExport = findDefaultExport(sourceFile);

  if (
    !(
      defaultExport &&
      findNodes(defaultExport, ts.SyntaxKind.JsxElement).length > 0
    )
  ) {
    return null;
  }

  return defaultExport;
}

export function getComponentPropsInterface(
  sourceFile: ts.SourceFile
): ts.InterfaceDeclaration | null {
  const cmpDeclaration = getComponentName(sourceFile);
  let propsTypeName: string = null;

  if (ts.isFunctionDeclaration(cmpDeclaration)) {
    const propsParam: ts.ParameterDeclaration = cmpDeclaration.parameters.find(
      (x) => ts.isParameter(x) && (x.name as ts.Identifier).text === 'props'
    );

    if (propsParam && propsParam.type) {
      propsTypeName = (
        (propsParam.type as ts.TypeReferenceNode).typeName as ts.Identifier
      ).text;
    }
  } else if (
    (cmpDeclaration as ts.VariableDeclaration).initializer &&
    ts.isArrowFunction((cmpDeclaration as ts.VariableDeclaration).initializer)
  ) {
    const arrowFn = (cmpDeclaration as ts.VariableDeclaration)
      .initializer as ts.ArrowFunction;

    const propsParam: ts.ParameterDeclaration = arrowFn.parameters.find(
      (x) => ts.isParameter(x) && (x.name as ts.Identifier).text === 'props'
    );

    if (propsParam && propsParam.type) {
      propsTypeName = (
        (propsParam.type as ts.TypeReferenceNode).typeName as ts.Identifier
      ).text;
    }
  } else if (
    // do we have a class component extending from React.Component
    ts.isClassDeclaration(cmpDeclaration) &&
    cmpDeclaration.heritageClauses &&
    cmpDeclaration.heritageClauses.length > 0
  ) {
    const heritageClause = cmpDeclaration.heritageClauses[0];

    if (heritageClause) {
      const propsTypeExpression = heritageClause.types.find((x) => {
        const name =
          (x.expression as ts.Identifier).escapedText ||
          (x.expression as ts.PropertyAccessExpression).name.text;
        return name === 'Component' || name === 'PureComponent';
      });

      if (propsTypeExpression && propsTypeExpression.typeArguments) {
        propsTypeName = (
          propsTypeExpression.typeArguments[0] as ts.TypeReferenceNode
        ).typeName.getText();
      }
    }
  } else {
    return null;
  }

  if (propsTypeName) {
    return findNodes(sourceFile, ts.SyntaxKind.InterfaceDeclaration).find(
      (x: ts.InterfaceDeclaration) => {
        return (x.name as ts.Identifier).getText() === propsTypeName;
      }
    ) as ts.InterfaceDeclaration;
  } else {
    return null;
  }
}
