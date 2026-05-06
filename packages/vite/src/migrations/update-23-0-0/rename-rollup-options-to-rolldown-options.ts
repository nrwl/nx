import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { Identifier } from 'typescript';
import picomatch = require('picomatch');

const ROLLUP_OPTIONS_IDENTIFIER_SELECTOR =
  'PropertyAssignment > Identifier[name=rollupOptions]';

const VITE_CONFIG_GLOB = '**/vite.*config*.{js,ts,mjs,mts,cjs,cts}';

export default async function renameRollupOptionsToRolldownOptions(tree: Tree) {
  const matchVite = picomatch(VITE_CONFIG_GLOB);

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!matchVite(filePath)) {
      return;
    }

    const contents = tree.read(filePath, 'utf-8');
    if (!contents.includes('rollupOptions')) {
      return;
    }

    const sourceFile = ast(contents);
    const identifiers = query<Identifier>(
      sourceFile,
      ROLLUP_OPTIONS_IDENTIFIER_SELECTOR
    );

    if (identifiers.length === 0) {
      return;
    }

    // Replace from end-to-start so positions stay valid as we mutate.
    let updated = contents;
    for (let i = identifiers.length - 1; i >= 0; i--) {
      const node = identifiers[i];
      updated =
        updated.slice(0, node.getStart()) +
        'rolldownOptions' +
        updated.slice(node.getEnd());
    }

    tree.write(filePath, updated);
  });

  await formatFiles(tree);
}
