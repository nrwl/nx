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

    it('keeps a directory whose name merely begins with dots', () => {
      // `..hidden` is an ordinary directory inside the workspace. Only a
      // leading `..` *segment* means the path climbed out of it.
      registerWorktree('dots', '..hidden/wt');

      expect(nestedWorktreeRoots(workspaceRoot)).toEqual(['..hidden/wt']);
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

  it('falls back to the git dir when commondir names something that is not a directory', () => {
    // Pointing `commondir` at a file has to give a different answer from
    // following it, or this pins nothing: following a file yields a
    // `worktrees` path underneath it, which reads as empty either way. So the
    // registration lives beside `commondir`, where only the fallback finds it.
    const metadataDir = join(workspaceRoot, '.git', 'worktrees', 'self');
    const notADirectory = join(workspaceRoot, '.git', 'not-a-dir');
    mkdirSync(metadataDir, { recursive: true });
    writeFileSync(notADirectory, 'x\n');
    writeFileSync(join(metadataDir, 'commondir'), `${notADirectory}\n`);

    // A workspace that is itself a linked worktree, so `commondir` is read.
    const workspace = mkdtempSync(join(tmpdir(), 'nx-fallback-'));
    writeFileSync(join(workspace, '.git'), `gitdir: ${metadataDir}\n`);

    const checkout = join(workspace, 'nested', 'wt');
    const innerMeta = join(metadataDir, 'worktrees', 'inner');
    mkdirSync(innerMeta, { recursive: true });
    mkdirSync(checkout, { recursive: true });
    writeFileSync(join(innerMeta, 'gitdir'), `${join(checkout, '.git')}\n`);
    writeFileSync(join(checkout, '.git'), `gitdir: ${innerMeta}\n`);

    expect(nestedWorktreeRoots(workspace)).toEqual(['nested/wt']);
  });

  describe('when the workspace sits below the git root', () => {
    // An Nx workspace nested in a larger repository is ordinary. Its worktrees
    // are registered against the repository, so looking only at
    // `<workspace>/.git` finds no registry and the reader gets the base
    // message with no mention of worktrees.
    let repoRoot: string;
    let workspace: string;

    beforeEach(() => {
      repoRoot = mkdtempSync(join(tmpdir(), 'nx-repo-'));
      mkdirSync(join(repoRoot, '.git'), { recursive: true });
      workspace = join(repoRoot, 'tools', 'workspace');
      mkdirSync(workspace, { recursive: true });
    });

    function registerAt(name: string, absoluteRoot: string) {
      const metadataDir = join(repoRoot, '.git', 'worktrees', name);
      mkdirSync(metadataDir, { recursive: true });
      mkdirSync(absoluteRoot, { recursive: true });
      writeFileSync(
        join(metadataDir, 'gitdir'),
        `${join(absoluteRoot, '.git')}\n`
      );
      writeFileSync(join(absoluteRoot, '.git'), `gitdir: ${metadataDir}\n`);
    }

    it('finds a worktree nested inside the workspace', () => {
      registerAt('wt', join(workspace, '.claude', 'worktrees', 'wt'));

      expect(nestedWorktreeRoots(workspace)).toEqual(['.claude/worktrees/wt']);
    });

    it('drops a worktree that is in the repo but outside the workspace', () => {
      // The walker never reaches it, so it cannot be causing the duplicate.
      registerAt('elsewhere', join(repoRoot, 'other', 'wt'));

      expect(nestedWorktreeRoots(workspace)).toEqual([]);
    });

    it('advises on a duplicate coming from the nested worktree', () => {
      registerAt('wt', join(workspace, '.claude', 'worktrees', 'wt'));

      expect(
        analyzeWorktreeConflicts(
          workspace,
          new Map([['ui', ['libs/ui', '.claude/worktrees/wt/libs/ui']]])
        )!.ignoreTargets
      ).toEqual(['/.claude/worktrees/wt']);
    });
  });

  describe('when the workspace is itself a linked worktree', () => {
    // Real layout: someone opens an agent worktree and runs Nx there, then
    // tooling makes more worktrees inside it. `.git` is a gitfile, so the
    // registry is only reachable by following `commondir` back to the main
    // repository - every worktree of a repo shares one registry.
    let mainRepo: string;
    let nestedWorkspace: string;

    beforeEach(() => {
      mainRepo = mkdtempSync(join(tmpdir(), 'nx-main-'));
      const mainGitDir = join(mainRepo, '.git');
      mkdirSync(mainGitDir, { recursive: true });

      // The workspace we run in is a worktree of `mainRepo`.
      nestedWorkspace = join(mainRepo, 'checkouts', 'workspace');
      const workspaceMeta = join(mainGitDir, 'worktrees', 'workspace');
      mkdirSync(workspaceMeta, { recursive: true });
      mkdirSync(nestedWorkspace, { recursive: true });
      writeFileSync(
        join(workspaceMeta, 'gitdir'),
        `${join(nestedWorkspace, '.git')}\n`
      );
      writeFileSync(
        join(nestedWorkspace, '.git'),
        `gitdir: ${workspaceMeta}\n`
      );
      writeFileSync(join(workspaceMeta, 'commondir'), '../..\n');

      // And an agent worktree nested inside that workspace.
      const agentMeta = join(mainGitDir, 'worktrees', 'agent');
      const agentCheckout = join(
        nestedWorkspace,
        '.claude',
        'worktrees',
        'agent'
      );
      mkdirSync(agentMeta, { recursive: true });
      mkdirSync(agentCheckout, { recursive: true });
      writeFileSync(
        join(agentMeta, 'gitdir'),
        `${join(agentCheckout, '.git')}\n`
      );
      writeFileSync(join(agentCheckout, '.git'), `gitdir: ${agentMeta}\n`);
      writeFileSync(join(agentMeta, 'commondir'), '../..\n');
    });

    it('follows commondir to find worktrees nested inside it', () => {
      expect(nestedWorktreeRoots(nestedWorkspace)).toEqual([
        '.claude/worktrees/agent',
      ]);
    });

    it('does not report the workspace itself', () => {
      // Its own registration resolves to the walk root, which is not nested.
      expect(nestedWorktreeRoots(nestedWorkspace)).not.toContain('');
    });

    it('advises on a duplicate coming from the nested worktree', () => {
      expect(
        analyzeWorktreeConflicts(
          nestedWorkspace,
          new Map([['ui', ['libs/ui', '.claude/worktrees/agent/libs/ui']]])
        )!.ignoreTargets
      ).toEqual(['/.claude/worktrees/agent']);
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
        ignoreTargets: ['/.claude/worktrees'],
        explainsAllConflicts: true,
      });
    });

    it('anchors a top-level worktree so it is a location, not a name', () => {
      // Bare `wt1` in a .gitignore matches any `wt1` at any depth.
      registerWorktree('one', 'wt1');

      expect(
        analyze({ ui: ['libs/ui', 'wt1/libs/ui'] })!.ignoreTargets
      ).toEqual(['/wt1']);
    });

    it('names a lone worktree rather than the directory holding it', () => {
      // `apps/` holds only the worktree today and is where the reader will put
      // projects tomorrow. Collapsing saves no lines here and risks all of them.
      registerWorktree('one', 'apps/wt');

      expect(analyze({ ui: ['libs/ui', 'apps/wt/libs/ui'] })).toEqual({
        ignoreTargets: ['/apps/wt'],
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
      ).toEqual(['/trees/one', '/trees/two']);
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
      ).toEqual(['/wt1', '/nested/wt2']);
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
