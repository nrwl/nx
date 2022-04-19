import * as ts from 'typescript';
import { applyChangesToString, stripIndents } from '@nrwl/devkit';
import { addRemoteDefinition, addRemoteToMfeConfig } from './mfe-ast-utils';
import { addRemoteRoute } from '@nrwl/react/src/mfe/mfe-ast-utils';

describe('addRemoteToMfeConfig', () => {
  it('should add to existing remotes array', async () => {
    const sourceCode = stripIndents`
      module.exports = {
        name: 'shell',
        remotes: [
          'app1',
          ['app2','//example.com']
        ]
      };
    `;

    const source = ts.createSourceFile(
      '/mfe.config.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = applyChangesToString(
      sourceCode,
      addRemoteToMfeConfig(source, 'new-app')
    );

    expect(result).toEqual(stripIndents`
      module.exports = {
        name: 'shell',
        remotes: [
          'app1',
          ['app2','//example.com'],
          'new-app',
        ]
      };
    `);
  });

  it('should create remotes array if none exist', async () => {
    const sourceCode = stripIndents`
      module.exports = {
        name: 'shell',
      };
    `;

    const source = ts.createSourceFile(
      '/mfe.config.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = applyChangesToString(
      sourceCode,
      addRemoteToMfeConfig(source, 'new-app')
    );

    expect(result).toEqual(stripIndents`
      module.exports = {
        name: 'shell',
        remotes: ['new-app']
      };
    `);
  });

  it.each`
    sourceCode
    ${"console.log('???');"}
    ${'module.exports = { remotes: {} }'}
    ${"module.exports = '???';"}
  `('should skip updates if format not as expected', async ({ sourceCode }) => {
    const source = ts.createSourceFile(
      '/mfe.config.js',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = applyChangesToString(
      sourceCode,
      addRemoteToMfeConfig(source, 'new-app')
    );

    expect(result).toEqual(sourceCode);
  });
});

describe('addRemoteDefinition', () => {
  it('should add to existing remotes array', async () => {
    const sourceCode = stripIndents`
      declare module 'app1/Module';
    `;

    const source = ts.createSourceFile(
      '/remotes.d.ts',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = applyChangesToString(
      sourceCode,
      addRemoteDefinition(source, 'app2')
    );

    expect(result).toEqual(stripIndents`
      declare module 'app1/Module';
      declare module 'app2/Module';
    `);
  });
});

describe('addRemoteRoute', () => {
  it('should add remote route to host app', async () => {
    const sourceCode = stripIndents`
      import * as React from 'react';
      import { Link, Route, Routes } from 'react-router-dom';

      const App1 = React.lazy(() => import('app1/Module'));

      export function App() {
        return (
          <React.Suspense fallback={null}>
            <ul>
              <li><Link to="/app1">App1</Link></li>
            </ul>
            <Routes>
              <Route path="/app1" element={<App1 />} />
            </Routes>
          </React.Suspense>
        );
      }

      export default App;
    `;

    const source = ts.createSourceFile(
      '/apps.tsx',
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const result = applyChangesToString(
      sourceCode,
      addRemoteRoute(source, { fileName: 'app2', className: 'App2' })
    );

    expect(result).toEqual(
      stripIndents`
      import * as React from 'react';
      import { Link, Route, Routes } from 'react-router-dom';

      const App2 = React.lazy(() => import('app2/Module'));
      
      const App1 = React.lazy(() => import('app1/Module'));

      export function App() {
        return (
          <React.Suspense fallback={null}>
            <ul>
              <li><Link to="/app1">App1</Link></li>
              <li><Link to="/app2">App2</Link></li>
            </ul>
            <Routes>
              <Route path="/app1" element={<App1 />} />
              <Route path="/app2" element={<App2 />} />
            </Routes>
          </React.Suspense>
        );
      }

      export default App;
    `
    );
  });
});
