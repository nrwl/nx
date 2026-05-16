import { formatFiles, globAsync, type Tree } from '@nx/devkit';

const OLD_HEADER = '// Jest Snapshot v1, https://goo.gl/fbAQLP';
const NEW_HEADER =
  '// Jest Snapshot v1, https://jestjs.io/docs/snapshot-testing';

export default async function updateSnapshotGuideLink(tree: Tree) {
  const snapshotFiles = await globAsync(tree, ['**/__snapshots__/*.snap']);

  for (const snapshotFile of snapshotFiles) {
    const content = tree.read(snapshotFile, 'utf-8');
    if (!content) {
      continue;
    }

    const newlineMatch = content.match(/\r?\n/);
    if (!newlineMatch) {
      continue;
    }

    const newline = newlineMatch[0];
    const firstNewlineIndex = content.indexOf(newline);
    const firstLine = content.slice(0, firstNewlineIndex);

    if (firstLine !== OLD_HEADER) {
      continue;
    }

    const updated = NEW_HEADER + content.slice(firstNewlineIndex);
    tree.write(snapshotFile, updated);
  }

  await formatFiles(tree);
}
