import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { nestedWorktreeRoots, worktreeIgnoreTarget } from './git-worktrees';

describe('git worktrees', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-worktrees-'));
    mkdirSync(join(workspaceRoot, '.git'), { recursive: true });
  });

  /**
   * Lays out a linked worktree the way `git worktree add` does: a registration
   * naming the checkout, and a gitfile in the checkout naming it back.
   */
  function registerWorktree(name: string, root: string) {
    const metadataDir = join(workspaceRoot, '.git', 'worktrees', name);
    const checkout = join(workspaceRoot, root);
    mkdirSync(metadataDir, { recursive: true });
    mkdirSync(checkout, { recursive: true });
    writeFileSync(join(metadataDir, 'gitdir'), `${join(checkout, '.git')}\n`);
    writeFileSync(join(checkout, '.git'), `gitdir: ${metadataDir}\n`);
  }

  describe('nestedWorktreeRoots', () => {
    it('finds worktrees registered inside the workspace', () => {
      registerWorktree('wt', '.claude/worktrees/wt');

      expect(nestedWorktreeRoots(workspaceRoot)).toEqual([
        '.claude/worktrees/wt',
      ]);
    });

    it('returns nothing when the repo has no worktrees', () => {
      expect(nestedWorktreeRoots(workspaceRoot)).toEqual([]);
    });

    it('drops a worktree checked out beside the workspace', () => {
      // `git worktree add ../elsewhere` is ordinary, and nothing walks it.
      const metadataDir = join(workspaceRoot, '.git', 'worktrees', 'outside');
      const checkout = join(workspaceRoot, '..', 'outside-wt');
      mkdirSync(metadataDir, { recursive: true });
      mkdirSync(checkout, { recursive: true });
      writeFileSync(join(metadataDir, 'gitdir'), `${join(checkout, '.git')}\n`);
      writeFileSync(join(checkout, '.git'), `gitdir: ${metadataDir}\n`);

      expect(nestedWorktreeRoots(workspaceRoot)).toEqual([]);
    });
  });

  describe('worktreeIgnoreTarget', () => {
    it('names the directory holding the worktrees', () => {
      registerWorktree('one', '.claude/worktrees/one');
      registerWorktree('two', '.claude/worktrees/two');

      expect(
        worktreeIgnoreTarget(workspaceRoot, [
          'packages/app',
          '.claude/worktrees/one/packages/app',
        ])
      ).toEqual(['.claude/worktrees']);
    });

    it('names the worktrees themselves when their directory holds anything else', () => {
      // Ignoring the directory would drop `notes` from the graph too.
      registerWorktree('one', 'trees/one');
      mkdirSync(join(workspaceRoot, 'trees/notes'), { recursive: true });

      expect(
        worktreeIgnoreTarget(workspaceRoot, ['libs/a', 'trees/one/libs/a'])
      ).toEqual(['trees/one']);
    });

    it('names the worktrees themselves when they share no directory', () => {
      // Their common parent is the workspace root, which is never the answer.
      registerWorktree('one', 'wt1');
      registerWorktree('two', 'nested/wt2');

      expect(
        worktreeIgnoreTarget(workspaceRoot, ['wt1/libs/a', 'nested/wt2/libs/a'])
      ).toEqual(['wt1', 'nested/wt2']);
    });

    it('stays out of the way when the duplicates are not from worktrees', () => {
      registerWorktree('one', '.claude/worktrees/one');

      expect(
        worktreeIgnoreTarget(workspaceRoot, ['packages/a', 'packages/b'])
      ).toBeNull();
    });

    it('stays out of the way when there are no worktrees at all', () => {
      expect(
        worktreeIgnoreTarget(workspaceRoot, ['packages/a', 'packages/b'])
      ).toBeNull();
    });

    it('does not read a sibling whose name merely starts the same', () => {
      registerWorktree('one', 'trees/wt');
      mkdirSync(join(workspaceRoot, 'trees/wt-other'), { recursive: true });

      expect(
        worktreeIgnoreTarget(workspaceRoot, ['trees/wt-other/libs/a'])
      ).toBeNull();
    });
  });
});
