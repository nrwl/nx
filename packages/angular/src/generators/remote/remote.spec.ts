import {
  readProjectConfiguration,
  readWorkspaceConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import host from '../host/host';
import remote from './remote';

describe('MF Remote App Generator', () => {
  it('should generate a remote mf app with no host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await remote(tree, {
      name: 'test',
      port: 4201,
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a remote mf app with a host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    await host(tree, {
      name: 'host',
    });

    // ACT
    await remote(tree, {
      name: 'test',
      host: 'host',
    });

    // ASSERT
    expect(tree.read('apps/host/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should error when a remote app is attempted to be generated with an incorrect host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    try {
      await remote(tree, {
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
    const tree = createTreeWithEmptyWorkspace();
    await remote(tree, {
      name: 'existing',
      port: 4201,
    });

    // ACT
    await remote(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4202);
  });

  it('should generate a remote mf app and automatically find the next port available even when there are no other targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await remote(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4201);
  });

  it('should not set the remote as the default project', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    await remote(tree, {
      name: 'test',
      port: 4201,
    });

    // ASSERT
    const { defaultProject } = readWorkspaceConfiguration(tree);
    expect(defaultProject).toBeUndefined();
  });
});
