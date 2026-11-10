import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readJson,
  readNxJson,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

const NX_CYPRESS = '@nx/cypress';
const STORYBOOK_CYPRESS_PRESET = '@nx/storybook/presets/cypress';
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
] as const;

export default async function addNxCypressDependency(
  tree: Tree
): Promise<void> {
  if (!tree.exists('package.json') || isNxCypressDeclared(tree)) {
    return;
  }

  if (!usesNxCypressInConfig(tree) && !mentionsNxCypressInSource(tree)) {
    return;
  }

  addDependenciesToPackageJson(
    tree,
    {},
    { [NX_CYPRESS]: nxVersion },
    undefined,
    true
  );

  await formatFiles(tree);
}

function isNxCypressDeclared(tree: Tree): boolean {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!(dependencies?.[NX_CYPRESS] || devDependencies?.[NX_CYPRESS]);
}

function isNxCypressModule(specifier: unknown): boolean {
  return (
    typeof specifier === 'string' &&
    (specifier === NX_CYPRESS ||
      specifier.startsWith(`${NX_CYPRESS}/`) ||
      specifier === STORYBOOK_CYPRESS_PRESET)
  );
}

function isNxCypressExecutor(executor: string | undefined): boolean {
  return executor?.startsWith(`${NX_CYPRESS}:`) ?? false;
}

function usesNxCypressInConfig(tree: Tree): boolean {
  for (const [, project] of getProjects(tree)) {
    for (const target of Object.values(project.targets ?? {})) {
      if (isNxCypressExecutor(target.executor)) {
        return true;
      }
    }
  }

  const nxJson = readNxJson(tree);

  // targetDefaults are keyed by target name or executor, and a default can set
  // the executor that an empty project target inherits.
  for (const [targetOrExecutor, config] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    if (isNxCypressExecutor(targetOrExecutor)) {
      return true;
    }
    for (const entry of Array.isArray(config) ? config : [config]) {
      if (isNxCypressExecutor(entry?.executor)) {
        return true;
      }
    }
  }

  return (
    nxJson?.plugins?.some((plugin) =>
      isNxCypressModule(typeof plugin === 'string' ? plugin : plugin?.plugin)
    ) ?? false
  );
}

// Any quoted mention counts, loaded or not: JavaScript has too many ways to
// load a module to list, and a false match only adds an unused devDependency.
function mentionsNxCypressInSource(tree: Tree): boolean {
  let found = false;
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (
      found ||
      !SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))
    ) {
      return;
    }
    const content = tree.read(filePath, 'utf-8');
    if (content && mentionsNxCypressModule(content)) {
      found = true;
    }
  });
  return found;
}

// Each quote starts a candidate `@nx/` name (no quotes or line breaks). The
// lookahead stops a rejected template prefix from consuming a nested name.
const QUOTED_NX_NAME = /(?=(['"`])(@nx\/[^'"`\r\n]*)\1)/g;

function mentionsNxCypressModule(content: string): boolean {
  for (const [, , name] of decodeEscapes(content).matchAll(QUOTED_NX_NAME)) {
    if (isNxCypressModule(name)) {
      return true;
    }
  }
  return false;
}

// A JavaScript string escape: `\u{...}`, `\uXXXX`, `\xXX`, a legacy octal
// escape, or a backslash before any other character (CRLF counts as one).
const ESCAPE_SEQUENCE =
  /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-3][0-7]{0,2}|[4-7][0-7]?)|(\r\n|[\s\S]))/g;
const LINE_TERMINATOR = /^[\r\n\u2028\u2029]/;

// Lets escaped module names (`cypr\u0065ss`) match. Decoding the whole file
// keeps every quote character, so it cannot hide a quoted name.
function decodeEscapes(content: string): string {
  return content.replace(
    ESCAPE_SEQUENCE,
    (sequence, codePoint, unit, hex, octal, other) => {
      if (other !== undefined) {
        return LINE_TERMINATOR.test(other) ? '' : other;
      }
      if (octal !== undefined) {
        return String.fromCharCode(parseInt(octal, 8));
      }
      const code = parseInt(codePoint ?? unit ?? hex, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : sequence;
    }
  );
}
