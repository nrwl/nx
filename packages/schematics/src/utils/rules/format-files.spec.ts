import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';

import * as path from 'path';

import { createEmptyWorkspace } from '../testing-utils';
import { formatFiles } from './format-files';
import { serializeJson } from '../fileutils';

describe('formatFiles', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;
  beforeEach(() => {
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../../collection.json')
    );
    tree = createEmptyWorkspace(Tree.empty());
    tree.overwrite(
      'package.json',
      serializeJson({
        scripts: {
          format: 'prettier'
        }
      })
    );
  });

  it('should format files', done => {
    schematicRunner.callRule(formatFiles(), tree).subscribe(result => {
      expect(schematicRunner.tasks.length).toBe(1);
      expect(schematicRunner.tasks[0]).toEqual({
        name: 'node-package',
        options: {
          packageName: 'run format -- --untracked',
          quiet: true
        }
      });
      done();
    });
  });

  it('should not format files if there is no format npm script', done => {
    tree.overwrite(
      'package.json',
      serializeJson({
        scripts: {}
      })
    );
    schematicRunner.callRule(formatFiles(), tree).subscribe(result => {
      expect(schematicRunner.tasks.length).toBe(0);
      //TODO: test that a warning is emitted.
      done();
    });
  });

  it('should not format files if skipFormat is passed', done => {
    schematicRunner
      .callRule(formatFiles({ skipFormat: true }), tree)
      .subscribe(result => {
        expect(schematicRunner.tasks.length).toBe(0);
        //TODO: test that a warning is not emitted.
        done();
      });
  });
});
