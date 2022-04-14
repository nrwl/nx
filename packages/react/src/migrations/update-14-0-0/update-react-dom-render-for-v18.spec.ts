import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readJson,
  stripIndents,
  writeJson,
} from '@nrwl/devkit';
import update from './update-react-dom-render-for-v18';

describe('React update for Nx 14', () => {
  it('should remove deprecated @testing-library/react-hook package', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@testing-library/react': '0.0.0',
        '@testing-library/react-hook': '0.0.0',
      },
    });

    await update(tree);

    expect(readJson(tree, 'package.json')).toEqual({
      devDependencies: {
        '@testing-library/react': '0.0.0',
        '@testing-library/react-hook': '0.0.0',
      },
    });
  });

  it.each`
    ext
    ${'js'}
    ${'jsx'}
    ${'tsx'}
  `('should update react-dom render call if it exists', async ({ ext }) => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example/src',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/web:webpack',
            options: {
              main: `apps/example/src/main.${ext}`,
            },
          },
        },
      },
      true
    );
    tree.write(
      `apps/example/src/main.${ext}`,
      stripIndents`
      import { Strict } from 'react';
      import * as ReactDOM from 'react-dom';
      import App from './app/app';
      
      ReactDOM.render(
        <Strict>
          <App/>
        </Strict>,
        document.getElementById('root')
      );
    `
    );

    await update(tree);

    expect(tree.read(`apps/example/src/main.${ext}`).toString()).toEqual(
      stripIndents`
        import { Strict } from 'react';
        import * as ReactDOM from 'react-dom/client';
        import App from './app/app';
        
        const root = ReactDOM.createRoot(
          document.getElementById('root')${
            ext === 'tsx' ? ' as HTMLElement' : ''
          }
        );
        root.render(
          <Strict>
            <App/>
          </Strict>
        );
      `
    );
  });

  it('should skip update if main file does not contain react-dom', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example/src',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/web:webpack',
            options: {
              main: `apps/example/src/main.tsx`,
            },
          },
        },
      },
      true
    );
    tree.write(
      `apps/example/src/main.tsx`,
      stripIndents`
        import { AppRegistry } from 'react-native';
        import App from './app/App';

        AppRegistry.registerComponent('main', () => App);
      `
    );

    await update(tree);

    expect(tree.read(`apps/example/src/main.tsx`).toString()).toEqual(
      stripIndents`
        import { AppRegistry } from 'react-native';
        import App from './app/App';

        AppRegistry.registerComponent('main', () => App);
      `
    );
  });
});
