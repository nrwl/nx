import { Tree } from '@angular-devkit/schematics';
import { runSchematic } from '../../utils/testing';

describe('workspace', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
  });

  it('should error if no package.json is present', async () => {
    try {
      await runSchematic('ng-add', { name: 'myApp' }, appTree);
      fail('should throw');
    } catch (e) {
      expect(e.message).toContain('Cannot find package.json');
    }
  });

  it('should error if no e2e/protractor.conf.js is present', async () => {
    appTree.create('/package.json', JSON.stringify({}));
    appTree.create(
      '/angular.json',
      JSON.stringify({
        projects: {
          proj1: {
            architect: {
              e2e: {
                options: {
                  protractorConfig: 'e2e/protractor.conf.js'
                }
              }
            }
          }
        }
      })
    );

    try {
      await runSchematic('ng-add', { name: 'proj1' }, appTree);
    } catch (e) {
      expect(e.message).toContain(
        'An e2e project was specified but e2e/protractor.conf.js could not be found.'
      );
    }
  });

  it('should error if no angular.json is present', async () => {
    try {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/e2e/protractor.conf.js', '');
      await runSchematic('ng-add', { name: 'myApp' }, appTree);
    } catch (e) {
      expect(e.message).toContain('Cannot find angular.json');
    }
  });

  it('should error if the angular.json specifies more than one app', async () => {
    appTree.create('/package.json', JSON.stringify({}));
    appTree.create('/e2e/protractor.conf.js', '');
    appTree.create(
      '/angular.json',
      JSON.stringify({
        projects: {
          proj1: {},
          'proj1-e2e': {},
          proj2: {},
          'proj2-e2e': {}
        }
      })
    );
    try {
      await runSchematic('ng-add', { name: 'myApp' }, appTree);
    } catch (e) {
      expect(e.message).toContain('Can only convert projects with one app');
    }
  });
});
