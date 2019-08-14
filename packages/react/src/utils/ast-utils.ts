import {
  addGlobal,
  Change,
  findNodes,
  InsertChange
} from '@nrwl/workspace/src/utils/ast-utils';
import * as ts from 'typescript';
import { noop, SchematicContext } from '@angular-devkit/schematics';
import { join } from '@angular-devkit/core';

export function addInitialRoutes(
  sourcePath: string,
  source: ts.SourceFile,
  context: SchematicContext
): Change[] {
  const jsxClosingElements = findNodes(source, [
    ts.SyntaxKind.JsxClosingElement,
    ts.SyntaxKind.JsxClosingFragment
  ]);
  const outerMostJsxClosing = jsxClosingElements[jsxClosingElements.length - 1];

  if (!outerMostJsxClosing) {
    context.logger.warn(
      `Could not find JSX elements in ${sourcePath}; Skipping insert routes`
    );
    return [];
  }

  const insertRoutes = new InsertChange(
    sourcePath,
    outerMostJsxClosing.getStart(),
    `
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
    `
  );

  return [
    ...addGlobal(
      source,
      sourcePath,
      `import { Route, Link } from 'react-router-dom';`
    ),
    insertRoutes
  ];
}

export function addRoute(
  sourcePath: string,
  source: ts.SourceFile,
  options: {
    routePath: string;
    componentName: string;
    moduleName: string;
  },
  context: SchematicContext
): Change[] {
  const routes = findElements(source, 'Route');
  const links = findElements(source, 'Link');

  if (routes.length === 0) {
    context.logger.warn(
      `Could not find <Route/> components in ${sourcePath}; Skipping add route`
    );
    return [];
  } else {
    const changes: Change[] = [];
    const firstRoute = routes[0];
    const firstLink = links[0];

    changes.push(
      ...addGlobal(
        source,
        sourcePath,
        `import { ${options.componentName} } from '${options.moduleName}';`
      )
    );

    changes.push(
      new InsertChange(
        sourcePath,
        firstRoute.getEnd(),
        `<Route path="${options.routePath}" component={${
          options.componentName
        }} />`
      )
    );

    if (firstLink) {
      const parentLi = findClosestOpening('li', firstLink);
      if (parentLi) {
        changes.push(
          new InsertChange(
            sourcePath,
            parentLi.getEnd(),
            `<li><Link to="${options.routePath}">${
              options.componentName
            }</Link></li>`
          )
        );
      } else {
        changes.push(
          new InsertChange(
            sourcePath,
            firstLink.parent.getEnd(),
            `<Link to="${options.routePath}">${options.componentName}</Link>`
          )
        );
      }
    }

    return changes;
  }
}

export function addBrowserRouter(
  sourcePath: string,
  source: ts.SourceFile,
  context: SchematicContext
): Change[] {
  const app = findElements(source, 'App')[0];
  if (app) {
    return [
      ...addGlobal(
        source,
        sourcePath,
        `import { BrowserRouter } from 'react-router-dom';`
      ),
      new InsertChange(sourcePath, app.getStart(), `<BrowserRouter>`),
      new InsertChange(sourcePath, app.getEnd(), `</BrowserRouter>`)
    ];
  } else {
    context.logger.warn(
      `Could not find App component in ${sourcePath}; Skipping add <BrowserRouter>`
    );
    return [];
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

export function findComponentImportPath(name: string, source: ts.SourceFile) {
  const allImports = findNodes(
    source,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];
  const matching = allImports.filter((i: ts.ImportDeclaration) => {
    return (
      i.importClause &&
      i.importClause.name &&
      i.importClause.name.getText() === name
    );
  });

  if (matching.length === 0) {
    return null;
  }

  const appImport = matching[0];
  return appImport.moduleSpecifier.getText().replace(/['"]/g, '');
}

// -----------------------------------------------------------------------------

function hasDefaultExportModifier(
  x: ts.ClassDeclaration | ts.FunctionDeclaration
) {
  return (
    x.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
    x.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
  );
}

function findElements(source: ts.SourceFile, tagName: string) {
  const nodes = findNodes(source, [
    ts.SyntaxKind.JsxSelfClosingElement,
    ts.SyntaxKind.JsxOpeningElement
  ]);
  return nodes.filter(node => isTag(tagName, node));
}

function findClosestOpening(tagName: string, node: ts.Node) {
  if (!node) {
    return null;
  }

  if (isTag(tagName, node)) {
    return node;
  } else {
    return findClosestOpening(tagName, node.parent);
  }
}

function isTag(tagName: string, node: ts.Node) {
  if (ts.isJsxOpeningLikeElement(node)) {
    return (
      node.tagName.kind === ts.SyntaxKind.Identifier &&
      node.tagName.text === tagName
    );
  }

  if (ts.isJsxElement(node) && node.openingElement) {
    return (
      node.openingElement.tagName.kind === ts.SyntaxKind.Identifier &&
      node.openingElement.tagName.text === tagName
    );
  }

  return false;
}
