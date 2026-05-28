import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-snapshot-guide-link';

const OLD_HEADER = '// Jest Snapshot v1, https://goo.gl/fbAQLP';
const NEW_HEADER =
  '// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing';

describe('update-snapshot-guide-link migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rewrite the legacy snapshot guide link to the new URL', async () => {
    tree.write(
      'apps/app1/src/__snapshots__/example.spec.ts.snap',
      `${OLD_HEADER}

exports[\`renders correctly 1\`] = \`"hello"\`;
`
    );

    await migration(tree);

    expect(
      tree.read('apps/app1/src/__snapshots__/example.spec.ts.snap', 'utf-8')
    ).toBe(
      `${NEW_HEADER}

exports[\`renders correctly 1\`] = \`"hello"\`;
`
    );
  });

  it('should leave snapshot files that already use the new URL untouched', async () => {
    const path = 'apps/app1/src/__snapshots__/already-new.spec.ts.snap';
    const original = `${NEW_HEADER}

exports[\`renders correctly 1\`] = \`"hello"\`;
`;
    tree.write(path, original);

    await migration(tree);

    expect(tree.read(path, 'utf-8')).toBe(original);
  });

  it('should not rewrite content past the first line', async () => {
    tree.write(
      'libs/lib1/src/__snapshots__/keep-body.spec.ts.snap',
      `${OLD_HEADER}

// the URL https://goo.gl/fbAQLP also appears in this snapshot body
exports[\`keeps body 1\`] = \`"https://goo.gl/fbAQLP"\`;
`
    );

    await migration(tree);

    const updated = tree.read(
      'libs/lib1/src/__snapshots__/keep-body.spec.ts.snap',
      'utf-8'
    );
    expect(updated).toBe(
      `${NEW_HEADER}

// the URL https://goo.gl/fbAQLP also appears in this snapshot body
exports[\`keeps body 1\`] = \`"https://goo.gl/fbAQLP"\`;
`
    );
  });

  it('should ignore non-snapshot files that contain the legacy URL', async () => {
    const path = 'apps/app1/src/notes.md';
    const original = `Some doc that happens to mention ${OLD_HEADER}.\n`;
    tree.write(path, original);

    await migration(tree);

    expect(tree.read(path, 'utf-8')).toBe(original);
  });

  it('should update multiple snapshot files in a single run', async () => {
    tree.write(
      'apps/app1/src/__snapshots__/a.spec.ts.snap',
      `${OLD_HEADER}\n\nexports[\`a 1\`] = \`"a"\`;\n`
    );
    tree.write(
      'libs/lib1/src/__snapshots__/b.spec.ts.snap',
      `${OLD_HEADER}\n\nexports[\`b 1\`] = \`"b"\`;\n`
    );

    await migration(tree);

    expect(
      tree.read('apps/app1/src/__snapshots__/a.spec.ts.snap', 'utf-8')
    ).toContain(NEW_HEADER);
    expect(
      tree.read('libs/lib1/src/__snapshots__/b.spec.ts.snap', 'utf-8')
    ).toContain(NEW_HEADER);
  });
});
