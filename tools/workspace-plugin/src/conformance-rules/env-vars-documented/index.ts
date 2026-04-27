import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import type { Tree } from '@nx/devkit';

type Options = {
  ignore?: string[];
};

const DOCS_PATH =
  'astro-docs/src/content/docs/reference/environment-variables.mdoc';
const NX_CORE_PROJECT = 'nx';
const MAX_EXAMPLE_FILES = 3;

const SCANNABLE_EXT = /\.(ts|tsx|js|mjs|cjs|rs)$/;
const TEST_FILE = /\.(spec|test)\.(ts|tsx|js)$/;
const EXCLUDED_SEGMENT = /(__fixtures__|__snapshots__|\/files\/|\/dist\/)/;

const TS_JS_USAGE = /process\.env(?:\.|\[['"`])(NX_[A-Z0-9_]+)/g;
const RUST_ENV_VAR = /(?:std::)?env::var(?:_os)?\s*\(\s*"(NX_[A-Z0-9_]+)"/g;
const RUST_FROM_ENV = /(?:try_)?from_env\s*\(\s*"(NX_[A-Z0-9_]+)"/g;
const DOCS_TABLE_ROW = /^\|\s*`(NX_[A-Z0-9_]+)`/gm;

export default createConformanceRule<Options>({
  name: 'env-vars-documented',
  category: 'consistency',
  description:
    'Ensures every NX_* environment variable in source code is covered by docs',
  implementation: async ({ tree, fileMapCache, ruleOptions }) => {
    const ignore = new Set(ruleOptions?.ignore ?? []);

    const docsContent = tree.read(DOCS_PATH, 'utf-8');
    if (!docsContent) {
      return {
        severity: 'high',
        details: {
          violations: [
            {
              message: `Could not read ${DOCS_PATH}. The conformance rule expects to run from the workspace root.`,
              file: DOCS_PATH,
            },
          ],
        },
      };
    }
    const documented = extractDocumentedVars(docsContent);

    const nxFiles =
      fileMapCache.fileMap.projectFileMap?.[NX_CORE_PROJECT] ?? [];
    const filesToScan = nxFiles
      .map(({ file }) => file)
      .filter(isScannableSourceFile);
    const usages = extractUsagesFromFiles(tree, filesToScan);

    const violations: ConformanceViolation[] = [];
    for (const [name, files] of usages) {
      if (documented.has(name) || ignore.has(name)) continue;
      const examples = [...files].join(', ');
      violations.push({
        message: `Env var \`${name}\` not documented. Found in ${examples}. Add a row to ${DOCS_PATH} or list \`${name}\` in the rule's "ignore" option.`,
        file: DOCS_PATH,
      });
    }

    return {
      severity: violations.length > 0 ? 'medium' : 'low',
      details: { violations },
    };
  },
});

function isScannableSourceFile(file: string): boolean {
  if (!SCANNABLE_EXT.test(file)) return false;
  if (TEST_FILE.test(file)) return false;
  if (EXCLUDED_SEGMENT.test(file)) return false;
  return true;
}

function extractUsagesFromFiles(
  tree: Tree,
  files: string[]
): Map<string, Set<string>> {
  const usages = new Map<string, Set<string>>();
  for (const file of files) {
    const content = tree.read(file, 'utf-8');
    if (!content) continue;
    for (const name of extractUsedVarsFromContent(content, file)) {
      let set = usages.get(name);
      if (!set) {
        set = new Set();
        usages.set(name, set);
      }
      if (set.size < MAX_EXAMPLE_FILES) set.add(file);
    }
  }
  return usages;
}

export function extractDocumentedVars(mdocContent: string): Set<string> {
  return new Set(Array.from(mdocContent.matchAll(DOCS_TABLE_ROW), (m) => m[1]));
}

export function extractUsedVarsFromContent(
  content: string,
  file: string
): string[] {
  const patterns = file.endsWith('.rs')
    ? [RUST_ENV_VAR, RUST_FROM_ENV]
    : [TS_JS_USAGE];
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const m of content.matchAll(pattern)) {
      found.push(m[1]);
    }
  }
  return found;
}
