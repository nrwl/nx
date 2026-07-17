import { formatFiles, type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import type { PropertyAssignment } from 'typescript';
import { cypressProjectConfigs } from '../../utils/migrations';

// Match both `experimentalPromptCommand: true` and `'experimentalPromptCommand': true`
// (string-literal keys appear in JSON-style configs and after some formatters).
const SELECTOR =
  'PropertyAssignment:has(Identifier[name=experimentalPromptCommand]),' +
  'PropertyAssignment:has(StringLiteral[value=experimentalPromptCommand])';

export default async function removeExperimentalPromptCommand(tree: Tree) {
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const contents = tree.read(cypressConfigPath, 'utf-8');
    if (!contents.includes('experimentalPromptCommand')) {
      continue;
    }

    const sourceFile = ast(contents);
    // `:has()` may match nested PropertyAssignments (e.g. an outer object whose
    // value contains the flag). Restrict to ones whose own `name` is the flag.
    const propAssigns = query<PropertyAssignment>(sourceFile, SELECTOR).filter(
      (p) => {
        const name = p.name;
        return (
          // Identifier name has `.text`; StringLiteral name does too.
          'text' in name && name.text === 'experimentalPromptCommand'
        );
      }
    );
    if (propAssigns.length === 0) {
      continue;
    }

    let updated = contents;
    // Walk end-to-start so positions remain valid as we slice.
    for (let i = propAssigns.length - 1; i >= 0; i--) {
      const propAssign = propAssigns[i];
      const start = propAssign.getStart(sourceFile);
      let end = propAssign.getEnd();
      // Eat a single trailing comma if present (prettier handles whitespace).
      if (updated[end] === ',') {
        end++;
      }
      updated = updated.slice(0, start) + updated.slice(end);
    }

    tree.write(cypressConfigPath, updated);
  }

  await formatFiles(tree);
}
