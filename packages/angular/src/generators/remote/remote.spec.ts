import { E2eTestRunner } from '../../utils/test-runners';
import {
  getProjects,
  readNxJson,
  readProjectConfiguration,
  stripIndents,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  generateTestHostApplication,
  generateTestRemoteApplication,
} from '../utils/testing';

describe('MF Remote App Generator', () => {
  it('should generate a remote mf app with no host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      port: 4201,
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a remote mf app with a host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestHostApplication(tree, {
      name: 'host',
    });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      host: 'host',
    });

    // ASSERT
    expect(tree.read('apps/host/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should error when a remote app is attempted to be generated with an incorrect host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    try {
      await generateTestRemoteApplication(tree, {
        name: 'test',
        host: 'host',
      });
    } catch (error) {
      // ASSERT
      expect(error.message).toEqual(
        'The name of the application to be used as the host app does not exist. (host)'
      );
    }
  });

  it('should generate a remote mf app and automatically find the next port available', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'existing',
      port: 4201,
    });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4202);
  });

  it('should generate a remote mf app and automatically find the next port available even when there are no other targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4201);
  });

  it('should not set the remote as the default project', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      port: 4201,
    });

    // ASSERT
    const { defaultProject } = readNxJson(tree);
    expect(defaultProject).toBeUndefined();
  });

  it('should generate the a remote setup for standalone components', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      standalone: true,
    });

    // ASSERT
    expect(tree.exists(`apps/test/src/app/app.module.ts`)).toBeFalsy();
    expect(tree.exists(`apps/test/src/app/app.component.ts`)).toBeFalsy();
    expect(
      tree.exists(`apps/test/src/app/remote-entry/entry.module.ts`)
    ).toBeFalsy();
    expect(tree.read(`apps/test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`apps/test/module-federation.config.js`, 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/test/src/app/remote-entry/entry.component.ts`, 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/test/src/app/app.routes.ts`, 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(`apps/test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not generate an e2e project when e2eTestRunner is none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
      e2eTestRunner: E2eTestRunner.None,
    });

    // ASSERT
    const projects = getProjects(tree);
    expect(projects.has('remote1-e2e')).toBeFalsy();
  });

  it('should generate a correct app component when inline template is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      inlineTemplate: true,
    });

    // ASSERT
    expect(tree.read('apps/test/src/app/app.component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';

      @Component({
        selector: 'proj-root',
        template: '<router-outlet></router-outlet>',
      })
      export class AppComponent {}
      "
    `);
  });

  it('should update the index.html to use the remote entry component selector for root when standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestRemoteApplication(tree, {
      name: 'test',
      standalone: true,
    });

    // ASSERT
    expect(tree.read('apps/test/src/index.html', 'utf-8')).not.toContain(
      'proj-root'
    );
    expect(tree.read('apps/test/src/index.html', 'utf-8')).toContain(
      'proj-test-entry'
    );
  });

  describe('--ssr', () => {
    it('should generate the correct files', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await generateTestRemoteApplication(tree, {
        name: 'test',
        ssr: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(
        tree.exists(`apps/test/src/app/remote-entry/entry.module.ts`)
      ).toBeTruthy();
      expect(
        tree.read(`apps/test/src/app/app.module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/bootstrap.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/main.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`apps/test/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`apps/test/module-federation.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/webpack.server.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/remote-entry/entry.component.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/remote-entry/entry.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets['static-server']).toMatchSnapshot();
    });
  });

  it('should error correctly when Angular version does not support standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': '14.0.0',
      },
    }));

    // ACT & ASSERT
    await expect(
      generateTestRemoteApplication(tree, {
        name: 'test',
        standalone: true,
      })
    ).rejects
      .toThrow(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using 14.0.0.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  });
});
