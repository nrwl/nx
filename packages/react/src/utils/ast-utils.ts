import {
  addGlobal,
  Change,
  findNodes,
  InsertChange
} from '@nrwl/workspace/src/utils/ast-utils';
import * as ts from 'typescript';

export function addRouter(sourcePath: string, source: ts.SourceFile): Change[] {
  const jsxClosing = findNodes(source, ts.SyntaxKind.JsxClosingElement);

  const outerMostJsxClosing = jsxClosing[jsxClosing.length - 1];

  const insertRoute = new InsertChange(
    sourcePath,
    outerMostJsxClosing.getStart(),
    `
    <hr style={{ margin: '36px 0' }}/>
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
    `
  );

  findDefaultExport(source);

  return [
    ...addGlobal(
      source,
      sourcePath,
      `import { Route, Link} from 'react-router-dom';`
    ),
    insertRoute
  ];
}

export function addRoute(
  sourcePath: string,
  source: ts.SourceFile,
  options: {
    libName: string;
    componentName: string;
    moduleName: string;
  }
): Change[] {
  const defaultExport = findDefaultExport(source);

  if (!defaultExport) {
    throw new Error(`Cannot find default export in ${sourcePath}`);
  }

  const elements = findNodes(
    defaultExport,
    ts.SyntaxKind.JsxSelfClosingElement
  ) as ts.JsxSelfClosingElement[];

  const routes = elements.filter(
    x =>
      x.tagName.kind === ts.SyntaxKind.Identifier && x.tagName.text === 'Route'
  );

  if (routes.length > 0) {
    const lastRoute = routes[0];

    const addImport = addGlobal(
      source,
      sourcePath,
      `import { ${options.componentName} } from '${options.moduleName}';`
    );

    const insertRoute = new InsertChange(
      sourcePath,
      lastRoute.getEnd(),
      `<Route path="/${options.libName}" component={${
        options.componentName
      }} />`
    );

    return [...addImport, insertRoute];
  } else {
    throw new Error(`Could not find routes in ${sourcePath}`);
  }
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
    const all = variables.concat(fns) as Array<
      ts.VariableDeclaration | ts.FunctionDeclaration
    >;

    const exported = all
      .filter(x => x.name.kind === ts.SyntaxKind.Identifier)
      .find(x => (x.name as ts.Identifier).text === identifier.text);

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
    .map(x => x.expression)
    .find(x => x.kind === ts.SyntaxKind.Identifier) as ts.Identifier;

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
    x.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
    x.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
  );
}
