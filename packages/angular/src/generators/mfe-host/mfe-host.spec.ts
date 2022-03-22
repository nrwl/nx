import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import mfeHost from './mfe-host';
import applicationGenerator from '../application/application';

describe('MFE Host App Generator', () => {
  it('should generate a host mfe app with no remotes', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    await mfeHost(tree, {
      name: 'test',
    });

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate a host mfe app with a remote', async () => {
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
    await mfeHost(tree, {
      name: 'test',
      remotes: ['remote'],
    });

    // ASSERT
    expect(
      tree.read('apps/remote/webpack.config.js', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should error when a host app is attempted to be generated with an incorrect remote', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    // ACT
    try {
      await mfeHost(tree, {
        name: 'test',
        remotes: ['remote'],
      });
    } catch (error) {
      // ASSERT
      expect(error.message).toEqual(
        'Could not find specified remote application (remote)'
      );
    }
  });
});
