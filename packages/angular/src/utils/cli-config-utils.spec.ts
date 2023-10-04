import { replaceAppNameWithPath } from './cli-config-utils';

describe('replaceAppNameWithPath', () => {
  it('when node is `application` and appName is `app` still returns the node', () => {
    const node = 'application';
    const appName = 'app';
    const root = 'apps/app';
    expect(replaceAppNameWithPath(node, appName, root)).toEqual(node);
  });

  it('when node is `library` and appName is `lib` still returns the node', () => {
    const node = 'library';
    const appName = 'lib';
    const root = 'libs/lib';
    expect(replaceAppNameWithPath(node, appName, root)).toEqual(node);
  });
});
