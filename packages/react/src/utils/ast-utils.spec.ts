import * as utils from './ast-utils';
import * as ts from 'typescript';
import { Tree } from '@angular-devkit/schematics';
import { insert } from '@nrwl/workspace/src/utils/ast-utils';

describe('react ast-utils', () => {
  describe('findDefaultExport', () => {
    it('should find exported variable', () => {
      const sourceCode = `
        const main = () => {}; 
        export default main;
      `;
      const source = ts.createSourceFile(
        'test.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });

    it('should find exported function', () => {
      const sourceCode = `
        function main() {} 
        export default main;
      `;
      const source = ts.createSourceFile(
        'test.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });

    it('should find default export function', () => {
      const sourceCode = `
        export default function main() {};
      `;
      const source = ts.createSourceFile(
        'test.ts',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });
  });

  describe('addRoute', () => {
    let tree: Tree;
    let context: any;

    beforeEach(() => {
      context = {
        warn: jest.fn()
      };
      tree = Tree.empty();
    });

    it('should add links and routes if they are not present', async () => {
      const sourceCode = `
import React from 'react';
const App = () => (
  <>
    <h1>Hello</h1>
  </>
);
export default App; 
      `;
      tree.create('app.tsx', sourceCode);
      const source = ts.createSourceFile(
        'app.tsx',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      insert(
        tree,
        'app.tsx',
        utils.addInitialRoutes('app.tsx', source, context)
      );

      const result = tree.read('app.tsx').toString();

      expect(result).toMatch(/role="navigation"/);
      expect(result).toMatch(/<Link\s+to="\/page-2"/);
      expect(result).toMatch(/<Route\s+path="\/page-2"/);
    });

    it('should update existing routes', async () => {
      const sourceCode = `
import React from 'react';
import { Home } from '@example/home';
const App = () => (
  <>
    <header>
      <h1>Hello</h1>
      <div role="navigation">
        <ul>
          <li><Link to="/">Home</Link></li>
        </ul>
      </div>
    </header>
    <p>Hello World!</p>
    <Route path="/" component={Home}/>
  </>
);
export default App; 
      `;
      tree.create('app.tsx', sourceCode);
      const source = ts.createSourceFile(
        'app.tsx',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      insert(
        tree,
        'app.tsx',
        utils.addRoute(
          'app.tsx',
          source,
          {
            routePath: '/about',
            componentName: 'About',
            moduleName: '@example/about'
          },
          context
        )
      );

      const result = tree.read('app.tsx').toString();

      expect(result).toMatch(/<li><Link\s+to="\/about"/);
      expect(result).toMatch(/<Route\s+path="\/about"\s+component={About}/);
    });
  });

  describe('addBrowserRouter', () => {
    let tree: Tree;
    let context: any;

    beforeEach(() => {
      context = {
        warn: jest.fn()
      };
      tree = Tree.empty();
    });

    it('should wrap around App component', () => {
      const sourceCode = `
import React from 'react';
import ReactDOM from 'react-dom';
import { App } from '@example/my-app';
ReactDOM.render(<App/>, document.getElementById('root'));
      `;
      tree.create('app.tsx', sourceCode);
      const source = ts.createSourceFile(
        'app.tsx',
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      insert(
        tree,
        'app.tsx',
        utils.addBrowserRouter('app.tsx', source, context)
      );

      const result = tree.read('app.tsx').toString();
      expect(result).toContain('<BrowserRouter><App/></BrowserRouter>');
    });
  });
});
