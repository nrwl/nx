import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeWorktreeConflicts, nestedWorktreeRoots } from './git-worktrees';

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

  describe('analyzeWorktreeConflicts', () => {
    function analyze(conflicts: Record<string, string[]>) {
      return analyzeWorktreeConflicts(
        workspaceRoot,
        new Map(Object.entries(conflicts))
      );
    }

    it('names the directory holding the worktrees once there is more than one', () => {
      registerWorktree('one', '.claude/worktrees/one');
      registerWorktree('two', '.claude/worktrees/two');

      expect(
        analyze({
          ui: ['libs/ui', '.claude/worktrees/one/libs/ui'],
          api: ['apps/api', '.claude/worktrees/two/apps/api'],
        })
      ).toEqual({
        ignoreTargets: ['.claude/worktrees'],
        explainsAllConflicts: true,
      });
    });

    it('names a lone worktree rather than the directory holding it', () => {
      // `apps/` holds only the worktree today and is where the reader will put
      // projects tomorrow. Collapsing saves no lines here and risks all of them.
      registerWorktree('one', 'apps/wt');

      expect(analyze({ ui: ['libs/ui', 'apps/wt/libs/ui'] })).toEqual({
        ignoreTargets: ['apps/wt'],
        explainsAllConflicts: true,
      });
    });

    it('names the worktrees themselves when their directory holds anything else', () => {
      // Ignoring the directory would drop `notes` from the graph too.
      registerWorktree('one', 'trees/one');
      registerWorktree('two', 'trees/two');
      mkdirSync(join(workspaceRoot, 'trees/notes'), { recursive: true });

      expect(
        analyze({
          a: ['libs/a', 'trees/one/libs/a'],
          b: ['libs/b', 'trees/two/libs/b'],
        })!.ignoreTargets
      ).toEqual(['trees/one', 'trees/two']);
    });

    it('names the worktrees themselves when they share no directory', () => {
      // Their common parent is the workspace root, which is never the answer.
      registerWorktree('one', 'wt1');
      registerWorktree('two', 'nested/wt2');

      expect(
        analyze({
          a: ['libs/a', 'wt1/libs/a'],
          b: ['libs/b', 'nested/wt2/libs/b'],
        })!.ignoreTargets
      ).toEqual(['wt1', 'nested/wt2']);
    });

    it('reports that ignoring them leaves duplicates the reader still owns', () => {
      registerWorktree('one', '.claude/worktrees/one');

      expect(
        analyze({
          ui: ['libs/ui', '.claude/worktrees/one/libs/ui'],
          dup: ['apps/a', 'apps/b'],
        })!.explainsAllConflicts
      ).toBe(false);
    });

    it('reports a duplicate that survives dropping the worktree copy', () => {
      // Three roots, one of them a worktree copy: the other two still collide.
      registerWorktree('one', '.claude/worktrees/one');

      expect(
        analyze({
          ui: ['libs/ui', 'apps/ui', '.claude/worktrees/one/libs/ui'],
        })!.explainsAllConflicts
      ).toBe(false);
    });

    it('stays out of the way when the duplicates are not from worktrees', () => {
      registerWorktree('one', '.claude/worktrees/one');

      expect(analyze({ dup: ['packages/a', 'packages/b'] })).toBeNull();
    });

    it('stays out of the way when there are no worktrees at all', () => {
      expect(analyze({ dup: ['packages/a', 'packages/b'] })).toBeNull();
    });

    it('does not read a sibling whose name merely starts the same', () => {
      registerWorktree('one', 'trees/wt');
      mkdirSync(join(workspaceRoot, 'trees/wt-other'), { recursive: true });

      expect(analyze({ a: ['libs/a', 'trees/wt-other/libs/a'] })).toBeNull();
    });
  });
});
