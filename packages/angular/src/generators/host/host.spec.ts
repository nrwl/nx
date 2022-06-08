import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import host from './host';
import applicationGenerator from '../application/application';
import remote from '../remote/remote';

describe('Host App Generator', () => {
  it('should generate a host app with no remotes', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    await host(tree, {
      name: 'test',
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host app with a remote', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    await applicationGenerator(tree, {
      name: 'remote',
      mfe: true,
      mfeType: 'remote',
      routing: true,
      port: 4201,
    });

    // ACT
    await host(tree, {
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
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT

    await host(tree, {
      name: 'hostApp',
      remotes: ['remote1', 'remote2'],
    });

    // ASSERT
    expect(tree.exists('apps/remote1/project.json')).toBeTruthy();
    expect(tree.exists('apps/remote2/project.json')).toBeTruthy();
    expect(
      tree.read('apps/host-app/module-federation.config.js', 'utf-8')
    ).toContain(`'remote1','remote2'`);
    expect(tree.read('apps/host-app/src/app/app.component.html', 'utf-8'))
      .toMatchInlineSnapshot(`
      "<ul class=\\"remote-menu\\">
      <li><a routerLink='/'>Home</a></li>

      <li><a routerLink='remote1'>Remote1</a></li>
      <li><a routerLink='remote2'>Remote2</a></li>
      </ul>
      <router-outlet></router-outlet>
      "
    `);
  });

  it('should generate a host, integrate existing remotes and generate any remotes that dont exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    await remote(tree, {
      name: 'remote1',
    });

    // ACT
    await host(tree, {
      name: 'hostApp',
      remotes: ['remote1', 'remote2', 'remote3'],
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
    const tree = createTreeWithEmptyWorkspace(2);
    await remote(tree, {
      name: 'remote1',
    });

    // ACT
    await host(tree, {
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
    ).toContain(`'remote1','foo-remote2','foo-remote3'`);
  });
});
