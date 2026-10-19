import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-ready-when-signal';

describe('add-ready-when-signal migration', () => {
  it('adds a signal readyWhen to Angular dev server targets only', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        serve: { executor: '@angular/build:dev-server', continuous: true },
        'serve-devkit': {
          executor: '@angular-devkit/build-angular:dev-server',
          continuous: true,
        },
        'serve-ssr': {
          executor: '@angular-devkit/build-angular:ssr-dev-server',
          continuous: true,
        },
        'serve-nx': { executor: '@nx/angular:dev-server', continuous: true },
        'serve-nguniversal': {
          executor: '@nguniversal/builders:ssr-dev-server',
          continuous: true,
        },
      },
    });

    await update(tree);

    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets.serve.readyWhen).toEqual({ signal: true });
    expect(targets['serve-devkit'].readyWhen).toEqual({ signal: true });
    expect(targets['serve-ssr'].readyWhen).toEqual({ signal: true });
    expect(targets['serve-nx'].readyWhen).toEqual({ signal: true });
    expect(targets['serve-nguniversal'].readyWhen).toBeUndefined();
  });
});
