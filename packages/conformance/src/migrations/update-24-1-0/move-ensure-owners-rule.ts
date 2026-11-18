import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

const MOVED_RULES = new Set([
  '@nx/conformance/ensure-owners',
  '@nx/powerpack-conformance/ensure-owners',
]);
const ENSURE_OWNERS_RULE = '@nx/owners/ensure-owners';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as ReturnType<typeof readNxJson> & {
    conformance?: { rules?: unknown };
  };
  const rules = nxJson?.conformance?.rules;
  if (!Array.isArray(rules)) {
    return { skipAgentic: true };
  }

  let updated = false;
  for (const entry of rules) {
    if (typeof entry?.rule === 'string' && MOVED_RULES.has(entry.rule)) {
      entry.rule = ENSURE_OWNERS_RULE;
      updated = true;
    }
  }
  if (!updated) {
    return { skipAgentic: true };
  }

  updateNxJson(tree, nxJson);

  const { dependencies = {}, devDependencies = {} } = readJson(
    tree,
    'package.json'
  );
  if (!dependencies['@nx/owners'] && !devDependencies['@nx/owners']) {
    addDependenciesToPackageJson(tree, {}, { '@nx/owners': nxVersion });
  }

  await formatFiles(tree);
}
