import type * as ts from 'typescript';
import { findNodes } from '@nx/js';
import { ChangeType, logger, StringChange, StringInsertion } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export function addImport(
  source: ts.SourceFile,
  statement: string
): StringChange[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const allImports = findNodes(source, tsModule.SyntaxKind.ImportDeclaration);
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  // 1. Try to find ReactDOM.render.
  const calls = findNodes(
    source,
    tsModule.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  for (const expr of calls) {
    const inner = expr.expression;
    // React 17 and below
    if (
      tsModule.isPropertyAccessExpression(inner) &&
      /ReactDOM/i.test(inner.expression.getText()) &&
      inner.name.getText() === 'render'
    ) {
      return expr;
    }

    // React 18
    if (
      tsModule.isPropertyAccessExpression(inner) &&
      /root/.test(inner.expression.getText()) &&
      inner.name.getText() === 'render'
    ) {
      return expr;
    }
  }

  // 2. Try to find render from 'react-dom'.
  const imports = findNodes(
    source,
    tsModule.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];
  const hasRenderImport = imports.some(
    (i) =>
      i.moduleSpecifier.getText().includes('react-dom') &&
      /\brender\b/.test(i.importClause.namedBindings.getText())
  );
  if (hasRenderImport) {
    const calls = findNodes(
      source,
      tsModule.SyntaxKind.CallExpression
    ) as ts.CallExpression[];
    for (const expr of calls) {
      if (expr.expression.getText() === 'render') {
        return expr;
      }
    }
  }

  return null;
}

export function findDefaultExport(
  source: ts.SourceFile
):
  | ts.VariableDeclaration
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | null {
  return (
    findDefaultExportDeclaration(source) || findDefaultClassOrFunction(source)
  );
}

export function findDefaultExportDeclaration(
  source: ts.SourceFile
):
  | ts.VariableDeclaration
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const identifier = findDefaultExportIdentifier(source);
  if (identifier) {
    const variables = findNodes(
      source,
      tsModule.SyntaxKind.VariableDeclaration
    );
    const fns = findNodes(source, tsModule.SyntaxKind.FunctionDeclaration);
    const cls = findNodes(source, tsModule.SyntaxKind.ClassDeclaration);
    const all = [...variables, ...fns, ...cls] as Array<
      ts.VariableDeclaration | ts.FunctionDeclaration | ts.ClassDeclaration
    >;

    const exported = all
      .filter((x) => x.name.kind === tsModule.SyntaxKind.Identifier)
      .find((x) => (x.name as ts.Identifier).text === identifier.text);

    return exported || null;
  } else {
    return null;
  }
}

export function findExportDeclarationsForJsx(
  source: ts.SourceFile
): Array<
  ts.VariableDeclaration | ts.FunctionDeclaration | ts.ClassDeclaration
> | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const variables = findNodes(source, tsModule.SyntaxKind.VariableDeclaration);
  const variableStatements = findNodes(
    source,
    tsModule.SyntaxKind.VariableStatement
  );
  const fns = findNodes(source, tsModule.SyntaxKind.FunctionDeclaration);
  const cls = findNodes(source, tsModule.SyntaxKind.ClassDeclaration);

  const exportDeclarations: ts.ExportDeclaration[] = findNodes(
    source,
    tsModule.SyntaxKind.ExportDeclaration
  ) as ts.ExportDeclaration[];

  let componentNamesNodes: ts.Node[] = [];

  exportDeclarations.forEach((node) => {
    componentNamesNodes = [
      ...componentNamesNodes,
      ...findNodes(node, tsModule.SyntaxKind.ExportSpecifier),
    ];
  });

  const componentNames = componentNamesNodes?.map((node) => node.getText());

  const all = [...variables, ...variableStatements, ...fns, ...cls] as Array<
    | ts.VariableDeclaration
    | ts.VariableStatement
    | ts.FunctionDeclaration
    | ts.ClassDeclaration
  >;
  let foundExport: ts.Node[];
  let foundJSX: ts.Node[];

  const nodesContainingJSX = all.filter((x) => {
    foundJSX = findNodes(x, [
      tsModule.SyntaxKind.JsxSelfClosingElement,
      tsModule.SyntaxKind.JsxOpeningElement,
    ]);
    return foundJSX?.length;
  });

  const exported = nodesContainingJSX.filter((x) => {
    foundExport = findNodes(x, tsModule.SyntaxKind.ExportKeyword);
    if (x.kind === tsModule.SyntaxKind.VariableStatement) {
      const nameNode = findNodes(
        x,
        tsModule.SyntaxKind.VariableDeclaration
      )?.[0] as ts.VariableDeclaration;
      return (
        nameNode?.name?.kind === tsModule.SyntaxKind.Identifier ||
        foundExport?.length ||
        componentNames?.includes(nameNode?.name?.getText())
      );
    } else {
      return (
        (x.name.kind === tsModule.SyntaxKind.Identifier &&
          foundExport?.length) ||
        componentNames?.includes(x.name.getText())
      );
    }
  });

  const exportedDeclarations: Array<
    ts.VariableDeclaration | ts.FunctionDeclaration | ts.ClassDeclaration
  > = exported.map((x) => {
    if (x.kind === tsModule.SyntaxKind.VariableStatement) {
      const nameNode = findNodes(
        x,
        tsModule.SyntaxKind.VariableDeclaration
      )?.[0] as ts.VariableDeclaration;
      return nameNode;
    }
    return x;
  });

  return exportedDeclarations || null;
}

export function findDefaultExportIdentifier(
  source: ts.SourceFile
): ts.Identifier | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const exports = findNodes(
    source,
    tsModule.SyntaxKind.ExportAssignment
  ) as ts.ExportAssignment[];
  const identifier = exports
    .map((x) => x.expression)
    .find((x) => x.kind === tsModule.SyntaxKind.Identifier) as ts.Identifier;

  return identifier || null;
}

export function findDefaultClassOrFunction(
  source: ts.SourceFile | null
): ts.FunctionDeclaration | ts.ClassDeclaration | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const fns = findNodes(
    source,
    tsModule.SyntaxKind.FunctionDeclaration
  ) as ts.FunctionDeclaration[];
  const cls = findNodes(
    source,
    tsModule.SyntaxKind.ClassDeclaration
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  return (
    x.modifiers &&
    x.modifiers.some((m) => m.kind === tsModule.SyntaxKind.ExportKeyword) &&
    x.modifiers.some((m) => m.kind === tsModule.SyntaxKind.DefaultKeyword)
  );
}

export function findComponentImportPath(
  componentName: string,
  source: ts.SourceFile
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const allImports = findNodes(
    source,
    tsModule.SyntaxKind.ImportDeclaration
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const nodes = findNodes(source, [
    tsModule.SyntaxKind.JsxSelfClosingElement,
    tsModule.SyntaxKind.JsxOpeningElement,
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  if (tsModule.isJsxOpeningLikeElement(node)) {
    return (
      node.tagName.kind === tsModule.SyntaxKind.Identifier &&
      node.tagName.text === tagName
    );
  }

  if (tsModule.isJsxElement(node) && node.openingElement) {
    return (
      node.openingElement.tagName.kind === tsModule.SyntaxKind.Identifier &&
      node.openingElement.tagName.getText() === tagName
    );
  }

  return false;
}

export function addInitialRoutes(
  sourcePath: string,
  source: ts.SourceFile,
  addBrowserRouter?: boolean
): StringChange[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const jsxClosingElements = findNodes(source, [
    tsModule.SyntaxKind.JsxClosingElement,
    tsModule.SyntaxKind.JsxClosingFragment,
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
    <Routes>
      <Route
        path="/"
        element={
          <div>This is the generated root route. <Link to="/page-2">Click here for page 2.</Link></div>
        }
      />
      <Route
        path="/page-2"
        element={
          <div><Link to="/">Click here to go back to root page.</Link></div>
        }
      />
    </Routes>
    {/* END: routes */}
    `,
  };

  return [
    ...addImport(
      source,
      `import { Route, Routes, Link ${
        addBrowserRouter ? ', BrowserRouter ' : ''
      }} from 'react-router-dom';`
    ),
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
      text: `<Route path="${options.routePath}" element={<${options.componentName}/>} />`,
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

export function addStaticRouter(
  sourcePath: string,
  source: ts.SourceFile
): StringChange[] {
  const app = findElements(source, 'App')[0];
  if (app) {
    return [
      ...addImport(
        source,
        `import { StaticRouter } from 'react-router-dom/server';`
      ),
      {
        type: ChangeType.Insert,
        index: app.getStart(),
        text: `<StaticRouter location={req.originalUrl}>`,
      },
      {
        type: ChangeType.Insert,
        index: app.getEnd(),
        text: `</StaticRouter>`,
      },
    ];
  } else {
    logger.warn(
      `Could not find App component in ${sourcePath}; Skipping add <StaticRouter>`
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
    logger.warn(`Could not find render(...) in ${sourcePath}`);
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const calls = findNodes(
    source,
    tsModule.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  let reducerDescriptor: ts.ObjectLiteralExpression;
  // Look for configureStore call
  for (const expr of calls) {
    if (!expr.expression.getText().includes('configureStore')) {
      continue;
    }
    const arg = expr.arguments[0];
    if (tsModule.isObjectLiteralExpression(arg)) {
      let found: ts.ObjectLiteralExpression;
      for (const prop of arg.properties) {
        if (
          tsModule.isPropertyAssignment(prop) &&
          prop.name.getText() === 'reducer' &&
          tsModule.isObjectLiteralExpression(prop.initializer)
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
      if (tsModule.isObjectLiteralExpression(arg)) {
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

export function getComponentNode(sourceFile: ts.SourceFile): ts.Node | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const defaultExport = findDefaultExport(sourceFile);

  if (
    !(
      defaultExport &&
      (findNodes(defaultExport, tsModule.SyntaxKind.JsxElement).length > 0 ||
        findNodes(defaultExport, tsModule.SyntaxKind.JsxSelfClosingElement)
          .length > 0)
    )
  ) {
    return null;
  }

  return defaultExport;
}

export function parseComponentPropsInfo(
  sourceFile: ts.SourceFile,
  cmpDeclaration: ts.Node
): {
  props: Array<ts.PropertySignature | ts.BindingElement>;
  propsTypeName: string | null;
  inlineTypeString: string | null;
} | null {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  let propsTypeName: string = null;
  let inlineTypeString: string = null;
  const props: Array<ts.PropertySignature | ts.BindingElement> = [];

  const processParameters = (
    parameters: ts.NodeArray<ts.ParameterDeclaration>
  ): boolean => {
    if (!parameters.length) {
      return null;
    }

    const propsParam = parameters[0];
    if (propsParam.type) {
      if (tsModule.isTypeReferenceNode(propsParam.type)) {
        // function Cmp(props: Props) {}
        propsTypeName = propsParam.type.typeName.getText();
      } else if (tsModule.isTypeLiteralNode(propsParam.type)) {
        // function Cmp(props: {a: string, b: number}) {}
        props.push(
          ...(propsParam.type.members as ts.NodeArray<ts.PropertySignature>)
        );
        inlineTypeString = propsParam.type.getText();
      } else {
        // we don't support other types (e.g. union types)
        return false;
      }
    } else if (tsModule.isObjectBindingPattern(propsParam.name)) {
      // function Cmp({a, b}) {}
      props.push(...propsParam.name.elements);
      inlineTypeString = `{\n${propsParam.name.elements
        .map((x) => `${x.name.getText()}: unknown;\n`)
        .join('')}}`;
    } else {
      // function Cmp(props) {}
      return false;
    }

    return true;
  };

  if (tsModule.isFunctionDeclaration(cmpDeclaration)) {
    const result = processParameters(cmpDeclaration.parameters);
    if (!result) {
      return null;
    }
  } else if (
    tsModule.isVariableDeclaration(cmpDeclaration) &&
    cmpDeclaration.initializer &&
    tsModule.isArrowFunction(cmpDeclaration.initializer)
  ) {
    const result = processParameters(cmpDeclaration.initializer.parameters);
    if (!result) {
      return null;
    }
  } else if (
    // do we have a class component extending from React.Component
    tsModule.isClassDeclaration(cmpDeclaration) &&
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

      if (propsTypeExpression?.typeArguments?.[0]?.['typeName']) {
        propsTypeName = (
          propsTypeExpression.typeArguments[0] as ts.TypeReferenceNode
        ).typeName.getText();
      }
    }
  } else {
    return null;
  }

  if (propsTypeName) {
    const foundProps = getPropsFromTypeName(sourceFile, propsTypeName);
    if (!foundProps) {
      return null;
    }

    for (const prop of foundProps) {
      props.push(prop);
    }
  }

  return {
    propsTypeName,
    props,
    inlineTypeString,
  };
}

function getPropsFromTypeName(
  sourceFile: ts.SourceFile,
  propsTypeName: string
): Array<ts.PropertySignature | ts.BindingElement> {
  const matchingNode = findNodes(sourceFile, [
    tsModule.SyntaxKind.InterfaceDeclaration,
    tsModule.SyntaxKind.TypeAliasDeclaration,
  ]).find((x): x is ts.InterfaceDeclaration | ts.TypeAliasDeclaration => {
    if (
      tsModule.isTypeAliasDeclaration(x) ||
      tsModule.isInterfaceDeclaration(x)
    ) {
      return x.name.getText() === propsTypeName;
    }

    return false;
  });

  if (!matchingNode) {
    return null;
  }

  const props: Array<ts.PropertySignature | ts.BindingElement> = [];
  if (tsModule.isTypeAliasDeclaration(matchingNode)) {
    if (tsModule.isTypeLiteralNode(matchingNode.type)) {
      for (const prop of matchingNode.type.members) {
        props.push(prop as ts.PropertySignature);
      }
    } else if (tsModule.isTypeReferenceNode(matchingNode.type)) {
      const result = getPropsFromTypeName(
        sourceFile,
        matchingNode.type.typeName.getText()
      );
      if (result) {
        props.push(...result);
      }
    } else {
      // we don't support other types of type aliases (e.g. union types)
      return null;
    }
  } else {
    for (const prop of matchingNode.members) {
      props.push(prop as ts.PropertySignature);
    }
  }

  return props;
}
