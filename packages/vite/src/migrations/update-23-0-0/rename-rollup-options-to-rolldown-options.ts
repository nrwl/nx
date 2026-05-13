import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { Identifier, StringLiteral } from 'typescript';
import picomatch = require('picomatch');

// Matches both bare-key form (rollupOptions: ...) and quoted-key form
// ('rollupOptions': ...) so configs written with JSON-style quoting are caught.
const ROLLUP_OPTIONS_SELECTOR =
  'PropertyAssignment > :matches(Identifier[name=rollupOptions], StringLiteral[value=rollupOptions])';

const VITE_CONFIG_GLOB = '**/vite.*config*.{js,ts,mjs,mts,cjs,cts}';

export default async function renameRollupOptionsToRolldownOptions(tree: Tree) {
  const matchVite = picomatch(VITE_CONFIG_GLOB);

  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (!matchVite(filePath)) {
      return;
    }

    const contents = tree.read(filePath, 'utf-8');
    if (!contents) return;
    if (!contents.includes('rollupOptions')) {
      return;
    }

    const sourceFile = ast(contents);
    // Extra .text filter guards against the outer-PropertyAssignment descendant
    // trap: ensures the matched node's own name is `rollupOptions`, not a
    // nested node that merely contains an identifier with that name.
    const nodes = query<Identifier | StringLiteral>(
      sourceFile,
      ROLLUP_OPTIONS_SELECTOR
    ).filter((node) => (node as any).text === 'rollupOptions');

    if (nodes.length === 0) {
      return;
    }

    // Replace from end-to-start so positions stay valid as we mutate.
    let updated = contents;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const start = node.getStart();
      const end = node.getEnd();
      // Preserve quote style for StringLiteral keys ('rollupOptions' or "rollupOptions").
      const quoteChar = updated[start];
      const replacement =
        quoteChar === "'" || quoteChar === '"'
          ? `${quoteChar}rolldownOptions${quoteChar}`
          : 'rolldownOptions';
      updated = updated.slice(0, start) + replacement + updated.slice(end);
    }

    tree.write(filePath, updated);
  });

  await formatFiles(tree);
}
