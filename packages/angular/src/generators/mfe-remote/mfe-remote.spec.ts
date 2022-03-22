import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import mfeRemote from './mfe-remote';
import applicationGenerator from '../application/application';
import { readProjectConfiguration } from '@nrwl/devkit';

describe('MFE Remote App Generator', () => {
  it('should generate a remote mfe app with no host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    await mfeRemote(tree, {
      name: 'test',
      port: 4201,
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a remote mfe app with a host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    await applicationGenerator(tree, {
      name: 'host',
      mfe: true,
      mfeType: 'host',
      routing: true,
    });

    // ACT
    await mfeRemote(tree, {
      name: 'test',
      host: 'host',
      port: 4201,
    });

    // ASSERT
    expect(tree.read('apps/host/webpack.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should error when a remote app is attempted to be generated with an incorrect host', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    try {
      await mfeRemote(tree, {
        name: 'test',
        host: 'host',
        port: 4201,
      });
    } catch (error) {
      // ASSERT
      expect(error.message).toEqual(
        'The name of the application to be used as the host app does not exist. (host)'
      );
    }
  });

  it('should generate a remote mfe app and automatically find the next port available', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    await mfeRemote(tree, {
      name: 'existing',
      port: 4201,
    });

    // ACT
    await mfeRemote(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4202);
  });

  it('should generate a remote mfe app and automatically find the next port available even when there are no other targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    await mfeRemote(tree, {
      name: 'test',
    });

    // ASSERT
    const project = readProjectConfiguration(tree, 'test');
    expect(project.targets.serve.options.port).toEqual(4201);
  });
});
