import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { basename } from 'node:path';
import {
  applyEdits,
  modify,
  parse,
  type JSONPath,
  type ParseError,
} from 'jsonc-parser';

const FORMATTING_OPTIONS = {
  formattingOptions: { keepLines: true, insertSpaces: true, tabSize: 2 },
};

const JSON_CONFIG_FILES = new Set([
  '.babelrc',
  '.babelrc.json',
  'babel.config.json',
]);
const JS_CONFIG_FILE = /^(\.babelrc|babel\.config)\.(c|m)?(js|ts)$/;

// `@nx/react/babel` and `@nx/web/babel` forward their options to `@nx/js/babel`.
const NX_PRESETS = new Set([
  '@nx/js/babel',
  '@nx/react/babel',
  '@nx/web/babel',
]);

export default async function replaceBabelClassPropertiesLoose(tree: Tree) {
  const unparsable: string[] = [];
  const jsConfigs: string[] = [];

  visitNotIgnoredFiles(tree, '', (path) => {
    const name = basename(path);
    const isJson = JSON_CONFIG_FILES.has(name);
    if (!isJson && !JS_CONFIG_FILE.test(name)) return;
    const content = tree.read(path, 'utf-8');
    if (!isJson) {
      // Preset options may be imported from another file, so flag every JS
      // config that uses an Nx preset.
      if ([...NX_PRESETS].some((preset) => content.includes(preset))) {
        jsConfigs.push(path);
      }
      return;
    }
    if (!content.includes('classProperties')) return;

    const errors: ParseError[] = [];
    const config = parse(content, errors, { allowTrailingComma: true });
    if (errors.length || !config || typeof config !== 'object') {
      unparsable.push(path);
      return;
    }

    let updated = content;
    for (const optionsPath of findNxPresetOptions(config)) {
      const options = getAt(config, optionsPath);
      if (!options || !('classProperties' in options)) continue;
      // `classProperties.loose` used to take precedence over `loose`.
      const loose = options.classProperties?.loose;
      if (loose !== undefined) {
        updated = applyEdits(
          updated,
          modify(updated, [...optionsPath, 'loose'], loose, FORMATTING_OPTIONS)
        );
      }
      updated = applyEdits(
        updated,
        modify(
          updated,
          [...optionsPath, 'classProperties'],
          undefined,
          FORMATTING_OPTIONS
        )
      );
    }
    if (updated !== content) tree.write(path, updated);
  });

  await formatFiles(tree);

  const nextSteps = [
    ...unparsable.map(
      (path) =>
        `Could not parse ${path}. If it passes \`classProperties.loose\` to an Nx babel preset, replace it with the \`loose\` option.`
    ),
    ...jsConfigs.map(
      (path) =>
        `${path} uses an Nx babel preset. If its preset options set \`classProperties.loose\`, replace it with the \`loose\` option.`
    ),
  ];
  return nextSteps.length
    ? { nextSteps, agentContext: nextSteps }
    : { skipAgentic: true };
}

// Babel accepts presets at the top level, under `env.<name>`, in `overrides[]`
// and under `overrides[].env.<name>`.
function findNxPresetOptions(config: any): JSONPath[] {
  const scopes: JSONPath[] = [[]];
  (Array.isArray(config.overrides) ? config.overrides : []).forEach((_, i) =>
    scopes.push(['overrides', i])
  );
  for (const scope of [...scopes]) {
    for (const env of Object.keys(getAt(config, [...scope, 'env']) ?? {})) {
      scopes.push([...scope, 'env', env]);
    }
  }

  const result: JSONPath[] = [];
  for (const scope of scopes) {
    const presets = getAt(config, [...scope, 'presets']);
    if (!Array.isArray(presets)) continue;
    presets.forEach((preset, i) => {
      if (
        Array.isArray(preset) &&
        NX_PRESETS.has(preset[0]) &&
        preset[1] &&
        typeof preset[1] === 'object'
      ) {
        result.push([...scope, 'presets', i, 1]);
      }
    });
  }
  return result;
}

function getAt(value: any, path: JSONPath): any {
  return path.reduce((current, key) => current?.[key], value);
}
