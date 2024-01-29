import { updateJson } from '@nx/devkit';
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
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });
  it('should generate a host app with no remotes when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'test',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host app with a remote', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestRemoteApplication(tree, {
      name: 'remote',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'test',
      remotes: ['remote'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('remote/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });
  it('should generate a host app with a remote when --typesscript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestRemoteApplication(tree, {
      name: 'remote',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'test',
      remotes: ['remote'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.read('remote/webpack.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/webpack.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host and any remotes that dont exist with correct routing setup', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT

    await generateTestHostApplication(tree, {
      name: 'host-app',
      remotes: ['remote1', 'remote2'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2'`);
    expect(tree.read('host-app/src/app/app.component.html', 'utf-8'))
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

  it('should generate a host and any remotes that dont exist with correct routing setup when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT

    await generateTestHostApplication(tree, {
      name: 'host-app',
      remotes: ['remote1', 'remote2'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2'`);
    expect(tree.read('host-app/src/app/app.component.html', 'utf-8'))
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
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(tree.exists('remote3/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('remote2/project.json')).toBeTruthy();
    expect(tree.exists('remote3/project.json')).toBeTruthy();
    expect(
      tree.read('host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host-app',
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: false,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory when --typescript=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, {
      name: 'remote1',
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host-app',
      directory: 'foo/host-app',
      remotes: ['remote1', 'remote2', 'remote3'],
      typescriptConfiguration: true,
      standalone: false,
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists('remote1/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote2/project.json')).toBeTruthy();
    expect(tree.exists('foo/remote3/project.json')).toBeTruthy();
    expect(
      tree.read('foo/host-app/module-federation.config.ts', 'utf-8')
    ).toContain(`'remote1','remote2','remote3'`);
  });

  it('should generate a host with remotes using standalone components', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host',
      remotes: ['remote1'],
      skipFormat: true,
    });

    // ASSERT
    expect(tree.exists(`host/src/app/app.module.ts`)).toBeFalsy();
    expect(tree.read(`host/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
    expect(
      tree.read(`host/src/app/app.component.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the correct app component spec file', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'host',
      remotes: ['remote1'],
      skipFormat: true,
    });

    // ASSERT
    expect(
      tree.read(`host/src/app/app.component.spec.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the correct app component spec file with a directory', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // ACT
    await generateTestHostApplication(tree, {
      name: 'dashboard',
      remotes: ['remote1'],
      directory: 'test/dashboard',
      skipFormat: true,
    });

    // ASSERT
    expect(
      tree.read(`test/dashboard/src/app/app.component.spec.ts`, 'utf-8')
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
      standalone: false,
      skipFormat: true,
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
        typescriptConfiguration: false,
        standalone: false,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(
        tree.read(`test/src/app/app.module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files when --typescript=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'test',
        ssr: true,
        typescriptConfiguration: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(
        tree.read(`test/src/app/app.module.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
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
        ssr: true,
        typescriptConfiguration: false,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(tree.exists(`test/src/app/app.module.ts`)).toBeFalsy();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.js`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    it('should generate the correct files for standalone when --typescript=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'test',
        ssr: true,
        typescriptConfiguration: true,
        skipFormat: true,
      });

      // ASSERT
      const project = readProjectConfiguration(tree, 'test');
      expect(tree.exists(`test/src/app/app.module.ts`)).toBeFalsy();
      expect(tree.read(`test/src/bootstrap.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/src/bootstrap.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      expect(tree.read(`test/server.ts`, 'utf-8')).toMatchSnapshot();
      expect(
        tree.read(`test/module-federation.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/webpack.server.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.routes.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read(`test/src/app/app.config.server.ts`, 'utf-8')
      ).toMatchSnapshot();
      expect(project.targets.server).toMatchSnapshot();
      expect(project.targets['serve-ssr']).toMatchSnapshot();
    });

    describe('compat', () => {
      it('should generate the correct main.server.ts', async () => {
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          dependencies: {
            '@angular/core': '15.2.0',
          },
        }));

        await generateTestHostApplication(tree, {
          name: 'test',
          ssr: true,
          skipFormat: true,
        });

        expect(tree.read(`test/src/main.server.ts`, 'utf-8')).toMatchSnapshot();
      });
    });
  });

  describe('--project-name-and-root-format=derived', () => {
    it('should generate a host, integrate existing remotes and generate any remotes that dont exist', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestRemoteApplication(tree, {
        name: 'remote1',
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: false,
        standalone: false,
        skipFormat: true,
      });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'hostApp',
        remotes: ['remote1', 'remote2', 'remote3'],
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: false,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
      expect(tree.exists('apps/remote2/project.json')).toBeTruthy();
      expect(tree.exists('apps/remote3/project.json')).toBeTruthy();
      expect(
        tree.read('apps/host-app/module-federation.config.js', 'utf-8')
      ).toContain(`'remote1','remote2','remote3'`);
    });

    it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestRemoteApplication(tree, {
        name: 'remote1',
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: false,
        standalone: false,
        skipFormat: true,
      });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'hostApp',
        directory: 'foo',
        remotes: ['remote1', 'remote2', 'remote3'],
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: false,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
      expect(tree.exists('apps/foo/remote2/project.json')).toBeTruthy();
      expect(tree.exists('apps/foo/remote3/project.json')).toBeTruthy();
      expect(
        tree.read('apps/foo/host-app/module-federation.config.js', 'utf-8')
      ).toContain(`'remote1','foo-remote2','foo-remote3'`);
    });
    it('should generate a host, integrate existing remotes and generate any remotes that dont exist, in a directory when --typescript=true', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestRemoteApplication(tree, {
        name: 'remote1',
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: true,
        standalone: false,
        skipFormat: true,
      });

      // ACT
      await generateTestHostApplication(tree, {
        name: 'hostApp',
        directory: 'foo',
        remotes: ['remote1', 'remote2', 'remote3'],
        projectNameAndRootFormat: 'derived',
        typescriptConfiguration: true,
        standalone: false,
        skipFormat: true,
      });

      // ASSERT
      expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
      expect(tree.exists('apps/foo/remote2/project.json')).toBeTruthy();
      expect(tree.exists('apps/foo/remote3/project.json')).toBeTruthy();
      expect(
        tree.read('apps/foo/host-app/module-federation.config.ts', 'utf-8')
      ).toContain(`'remote1','foo-remote2','foo-remote3'`);
    });
  });
});
