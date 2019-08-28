import * as utils from './ast-utils';
import * as ts from 'typescript';
import { Tree } from '@angular-devkit/schematics';
import { insert } from '@nrwl/workspace/src/utils/ast-utils';

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
    tree.create('/app.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/app.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/app.tsx',
      utils.addInitialRoutes('/app.tsx', source, context)
    );

    const result = tree.read('/app.tsx').toString();

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
    tree.create('/app.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/app.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/app.tsx',
      utils.addRoute(
        '/app.tsx',
        source,
        {
          routePath: '/about',
          componentName: 'About',
          moduleName: '@example/about'
        },
        context
      )
    );

    const result = tree.read('/app.tsx').toString();

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
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/main.tsx',
      utils.addBrowserRouter('/main.tsx', source, context)
    );

    const result = tree.read('/main.tsx').toString();
    expect(result).toContain('<BrowserRouter><App/></BrowserRouter>');
  });
});

describe('findMainRenderStatement', () => {
  let tree: Tree;
  let context: any;

  beforeEach(() => {
    context = {
      warn: jest.fn()
    };
    tree = Tree.empty();
  });

  it('should return render(...)', () => {
    const sourceCode = `
import React from 'react';
import ReactDOM from 'react-dom';
ReactDOM.render(<div/>, document.getElementById('root'));
      `;
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const node = utils.findMainRenderStatement(source);
    expect(node).toBeTruthy();
  });

  it('should return render(...)', () => {
    const sourceCode = `
import React from 'react';
import { render } from 'react-dom';
render(<div/>, document.getElementById('root'));
      `;
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const node = utils.findMainRenderStatement(source);
    expect(node).toBeTruthy();
  });

  it('should return null when not found', () => {
    const sourceCode = ``;
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const node = utils.findMainRenderStatement(source);
    expect(node).toBe(null);
  });
});

describe('addReduxStoreToMain', () => {
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
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/main.tsx',
      utils.addReduxStoreToMain('/main.tsx', source, context)
    );

    const result = tree.read('/main.tsx').toString();
    expect(result).toContain('redux-starter-kit');
    expect(result).toContain('const store = configureStore');
    expect(result).toContain('<Provider store={store}>');
  });
});

describe('updateReduxStore', () => {
  let tree: Tree;
  let context: any;

  beforeEach(() => {
    context = {
      warn: jest.fn()
    };
    tree = Tree.empty();
  });

  it('should update configureStore call', () => {
    const sourceCode = `
import { configureStore } from 'redux-starter-kit';
const store = configureStore({
  reducer: {}
});
      `;
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/main.tsx',
      utils.updateReduxStore('/main.tsx', source, context, {
        keyName: 'SLICE_KEY',
        reducerName: 'sliceReducer',
        modulePath: '@test/slice'
      })
    );

    const result = tree.read('/main.tsx').toString();
    expect(result).toContain(
      "import { SLICE_KEY, sliceReducer } from '@test/slice'"
    );
    expect(result).toContain('[SLICE_KEY]: sliceReducer');
  });

  it('should update combineReducer call', () => {
    const sourceCode = `
import { createStore, combineReducer } from 'redux';
const store = createStore(combineReducer({}));
      `;
    tree.create('/main.tsx', sourceCode);
    const source = ts.createSourceFile(
      '/main.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    insert(
      tree,
      '/main.tsx',
      utils.updateReduxStore('/main.tsx', source, context, {
        keyName: 'SLICE_KEY',
        reducerName: 'sliceReducer',
        modulePath: '@test/slice'
      })
    );

    const result = tree.read('/main.tsx').toString();
    expect(result).toContain(
      "import { SLICE_KEY, sliceReducer } from '@test/slice'"
    );
    expect(result).toContain('[SLICE_KEY]: sliceReducer');
  });
});
