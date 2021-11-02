import { replaceAppNameWithPath } from './cli-config-utils';

describe('replaceAppNameWithPath', () => {
  describe('when node is `application`', () => {
    describe('and appName is `app`', () => {
      it('still returns the node', () => {
        const node = 'application';
        const appName = 'app';
        const root = 'apps/app';
        expect(replaceAppNameWithPath(node, appName, root)).toEqual(node);
      });
    });
  });

  describe('when node is `library`', () => {
    describe('and appName is `lib`', () => {
      it('still returns the node', () => {
        const node = 'library';
        const appName = 'lib';
        const root = 'libs/lib';
        expect(replaceAppNameWithPath(node, appName, root)).toEqual(node);
      });
    });
  });
});
