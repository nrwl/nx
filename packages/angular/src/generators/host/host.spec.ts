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

  it('should generate a host and any remotes that dont exist', async () => {
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
    expect(tree.read('apps/host-app/mfe.config.js', 'utf-8')).toContain(
      `'remote1','remote2'`
    );
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
    expect(tree.read('apps/host-app/mfe.config.js', 'utf-8')).toContain(
      `'remote1','remote2','remote3'`
    );
  });
});
