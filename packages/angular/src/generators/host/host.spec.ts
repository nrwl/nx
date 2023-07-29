import { stripIndents, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  getProjects,
  readProjectConfiguration,
} from 'nx/src/generators/utils/project-configuration';
import { E2eTestRunner } from '../../utils/test-runners';
import {
  generateTestHostApplication,
  generateTestRemoteApplication,
} from '../utils/testing';

describe('Host App Generator', () => {
  it('should generate a host app with no remotes', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'test',
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host app with a remote', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestRemoteApplication(tree, {
      name: 'remote',
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'test',
      remotes: ['remote'],
    });

    // ASSERT
    expect(
      tree.read('apps/remote/webpack.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host and any remotes that dont exist with correct routing setup', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT

    await generateTestHostApplication(tree, {
      name: 'hostApp',
      remotes: ['remote1', 'remote2'],
    });

    // ASSERT
    expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
    expect(tree.exists('apps/remote2/project.json')).toBeTruthy();
    expect(
      tree.read('apps/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1', 'remote2'`);
    expect(tree.read('apps/host-app/src/app/app.component.html', 'utf-8'))
      .toMatchInlineSnapshot(`
      "<ul class="remote-menu">
        <li><a routerLink="/">Home</a></li>
        <li><a routerLink="remote1">Remote1</a></li>
        <li><a routerLink="remote2">Remote2</a></li>
      </ul>
      <router-outlet></router-outlet>
      "
    `);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'hostApp',
      remotes: ['remote1', 'remote2', 'remote3'],
    });

    // ASSERT
    expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
    expect(tree.exists('apps/remote2/project.json')).toBeTruthy();
    expect(tree.exists('apps/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('apps/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1', 'remote2', 'remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'hostApp',
      directory: 'foo',
      remotes: ['remote1', 'remote2', 'remote3'],
    });

    // ASSERT
    expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
    expect(tree.exists('apps/foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('apps/foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('apps/foo/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1', 'foo-remote2', 'foo-remote3'`);
  });

  it('should generate a host with remotes using standalone components', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host',
      remotes: ['remote1'],
      standalone: true,
    });

    // ASSERT
    expect(tree.exists(`apps/host/src/app/app.module.ts`)).toBeFalsy();
    expect(tree.read(`apps/host/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(tree.read(`apps/host/src/remotes.d.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`apps/host/src/app/app.component.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the correct app component spec file', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host',
      remotes: ['remote1'],
      standalone: true,
    });

    // ASSERT
    expect(
      tree.read(`apps/host/src/app/app.component.spec.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the correct app component spec file with a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'dashboard',
      remotes: ['remote1'],
      directory: 'test',
      standalone: true,
    });

    // ASSERT
    expect(
      tree.read(`apps/test/dashboard/src/app/app.component.spec.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not generate an e2e project when e2eTestRunner is none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'dashboard',
      remotes: ['remote1'],
      e2eTestRunner: E2eTestRunner.None,
    });

    // ASSERT
    const projects = getProjects(tree);
    expect(projects.has('dashboard-e2e')).toBeFalsy();
    expect(projects.has('remote1-e2e')).toBeFalsy();
  });

  describe('--ssr', () => {
    it('should generate the correct files', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'test',
        ssr: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
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
        tree.read(`apps/test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files for standalone', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'test',
        standalone: true,
        ssr: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(tree.exists(`apps/test/src/app/app.module.ts`)).toBeFalsy();
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
        tree.read(`apps/test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/app.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`apps/test/src/app/app.config.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
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
      generateTestHostApplication(tree, {
        name: 'test',
        standalone: true,
      })
    ).rejects
      .toThrow(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using 14.0.0.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  });
});
