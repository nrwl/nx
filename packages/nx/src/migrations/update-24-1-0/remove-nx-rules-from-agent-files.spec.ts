import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import update from './remove-nx-rules-from-agent-files';

const nxBlock = `<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks, always prefer running the task through \`nx\`

<!-- nx configuration end-->`;

const importBlock = `<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

@AGENTS.md

<!-- nx configuration end-->`;

describe('remove-nx-rules-from-agent-files migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'])(
    'should remove the Nx block from %s and keep the rest',
    async (file) => {
      tree.write(
        file,
        `# My workspace\n\nUse pnpm.\n\n${nxBlock}\n\n## More\n\nText\n`
      );

      await update(tree);

      expect(tree.read(file, 'utf-8')).toBe(
        '# My workspace\n\nUse pnpm.\n\n## More\n\nText\n'
      );
    }
  );

  it('should remove a block at the end of a file', async () => {
    tree.write('AGENTS.md', `# My workspace\n\n${nxBlock}\n`);

    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe('# My workspace\n');
  });

  it('should remove every block in a file', async () => {
    tree.write('AGENTS.md', `${nxBlock}\n\n# Mine\n\n${nxBlock}\n\nEnd\n`);

    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe('# Mine\n\nEnd\n');
  });

  it('should delete a file that only holds the Nx block', async () => {
    tree.write('AGENTS.md', `${nxBlock}\n`);
    tree.write('CLAUDE.md', nxBlock);

    await update(tree);

    expect(tree.exists('AGENTS.md')).toBe(false);
    expect(tree.exists('CLAUDE.md')).toBe(false);
  });

  it('should keep the AGENTS.md import when AGENTS.md still exists', async () => {
    tree.write('AGENTS.md', `# Mine\n\n${nxBlock}\n`);
    tree.write('CLAUDE.md', `${importBlock}\n`);

    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe('# Mine\n');
    expect(tree.read('CLAUDE.md', 'utf-8')).toBe('@AGENTS.md\n');
  });

  it('should remove the AGENTS.md import when AGENTS.md is deleted', async () => {
    tree.write('AGENTS.md', `${nxBlock}\n`);
    tree.write('CLAUDE.md', `# Claude\n\n${importBlock}\n`);

    await update(tree);

    expect(tree.exists('AGENTS.md')).toBe(false);
    expect(tree.read('CLAUDE.md', 'utf-8')).toBe('# Claude\n');
  });

  it("should remove the block from the files Gemini's contextFileName names", async () => {
    tree.write(
      '.gemini/settings.json',
      JSON.stringify({ contextFileName: ['docs/CONTEXT.md', 'OTHER.md'] })
    );
    tree.write('docs/CONTEXT.md', `# Context\n\n${nxBlock}\n`);
    tree.write('OTHER.md', `# Other\n\n${nxBlock}\n`);

    await update(tree);

    expect(tree.read('docs/CONTEXT.md', 'utf-8')).toBe('# Context\n');
    expect(tree.read('OTHER.md', 'utf-8')).toBe('# Other\n');
  });

  it('should not follow a contextFileName outside the workspace', async () => {
    tree.write(
      '.gemini/settings.json',
      JSON.stringify({ contextFileName: '../outside.md' })
    );

    await expect(update(tree)).resolves.toBeUndefined();
  });

  it('should still clean the default files when .gemini/settings.json is malformed', async () => {
    tree.write('.gemini/settings.json', '{ not json');
    tree.write('AGENTS.md', `# Mine\n\n${nxBlock}\n`);

    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe('# Mine\n');
  });

  it('should not change files without an Nx block', async () => {
    const original = '# Mine\n\n\nOdd   spacing  \n\n@AGENTS.md\n\n';
    tree.write('AGENTS.md', original);
    tree.write('CLAUDE.md', original);
    tree.write('README.md', `# Readme\n\n${nxBlock}\n`);

    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe(original);
    expect(tree.read('CLAUDE.md', 'utf-8')).toBe(original);
    expect(tree.read('README.md', 'utf-8')).toBe(`# Readme\n\n${nxBlock}\n`);
  });

  it('should be a no-op when run twice', async () => {
    tree.write('AGENTS.md', `# Mine\n\n${nxBlock}\n`);
    tree.write('CLAUDE.md', `${importBlock}\n`);

    await update(tree);
    const agentsAfterFirstRun = tree.read('AGENTS.md', 'utf-8');
    const claudeAfterFirstRun = tree.read('CLAUDE.md', 'utf-8');
    expect(agentsAfterFirstRun).not.toBeNull();
    await update(tree);

    expect(tree.read('AGENTS.md', 'utf-8')).toBe(agentsAfterFirstRun);
    expect(tree.read('CLAUDE.md', 'utf-8')).toBe(claudeAfterFirstRun);
  });
});
