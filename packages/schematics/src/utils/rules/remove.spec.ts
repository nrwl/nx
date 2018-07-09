/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable:non-null-operator
import { of as observableOf } from 'rxjs/observable/of';
import { callRule } from '@angular-devkit/schematics/src/rules/call';
import { VirtualTree, SchematicContext } from '@angular-devkit/schematics';
import { MatchWith, remove } from './remove';

const context: SchematicContext = null!;

// @Todo - Remove once https://github.com/angular/devkit/pull/599 is merged
describe('remove', () => {
  it('works on remove 1 file', done => {
    const tree = new VirtualTree();
    tree.create('a/b/file1', 'hello world');
    tree.create('a/b/file2', 'hello world');
    tree.create('a/c/file3', 'hello world');

    callRule(remove('/a/b/file2'), observableOf(tree), context)
      .toPromise()
      .then(result => {
        expect(result.exists('a/b/file1')).toBe(true);
        expect(result.exists('a/b/file2')).toBe(false);
        expect(result.exists('a/c/file3')).toBe(true);
      })
      .then(done, done.fail);
  });

  it('works on removing a subdirectory structure', done => {
    const tree = new VirtualTree();
    tree.create('a/b/file1', 'hello world');
    tree.create('a/b/file2', 'hello world');
    tree.create('a/c/file3', 'hello world');

    callRule(remove('/a/b', MatchWith.STARTS), observableOf(tree), context)
      .toPromise()
      .then(result => {
        expect(result.exists('a/b/file1')).toBe(false);
        expect(result.exists('a/b/file2')).toBe(false);
        expect(result.exists('a/c/file3')).toBe(true);
      })
      .then(done, done.fail);
  });
});
