import {
  createConformanceRule,
  type ConformanceViolation,
} from '@nx/conformance';
import { workspaceRoot } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Scope = 'nx' | 'all';

type Options = {
  scope?: Scope;
  ignore?: string[];
};

const DOCS_PATH =
  'astro-docs/src/content/docs/reference/environment-variables.mdoc';
const NX_CORE_PROJECT = 'nx';

const SCANNABLE_EXT = /\.(ts|tsx|js|mjs|cjs|rs)$/;
const TEST_FILE = /\.(spec|test)\.(ts|tsx|js)$/;
const EXCLUDED_SEGMENT = /(__fixtures__|__snapshots__|\/files\/|\/dist\/)/;

const TS_JS_USAGE = /process\.env(?:\.|\[['"`])(NX_[A-Z0-9_]+)/g;
const RUST_ENV_VAR = /(?:std::)?env::var(?:_os)?\s*\(\s*"(NX_[A-Z0-9_]+)"/g;
const RUST_ENV_MACRO = /env!\s*\(\s*"(NX_[A-Z0-9_]+)"/g;
const RUST_FROM_ENV = /(?:try_)?from_env\s*\(\s*"(NX_[A-Z0-9_]+)"/g;
const DOCS_TABLE_ROW = /^\|\s*`(NX_[A-Z0-9_]+)`/gm;

export default createConformanceRule<Options>({
  name: 'env-vars-documented',
  category: 'consistency',
  description:
    'Ensures every NX_* environment variable in source code is covered by docs',
  implementation: async ({ tree, fileMapCache, ruleOptions }) => {
    const scope: Scope = ruleOptions?.scope ?? 'nx';
    const ignore = new Set(ruleOptions?.ignore ?? []);

    const docsContent = tree.read(DOCS_PATH, 'utf-8');
    if (!docsContent) {
      return failure(
        `Could not read ${DOCS_PATH}. The conformance rule expects to run from the workspace root.`
      );
    }
    const documented = extractDocumentedVars(docsContent);

    const projectFileMap = fileMapCache.fileMap.projectFileMap ?? {};
    const filesToScan: string[] = [];
    for (const [projectName, projectFiles] of Object.entries(projectFileMap)) {
      if (scope === 'nx' && projectName !== NX_CORE_PROJECT) continue;
      for (const { file } of projectFiles) {
        if (isScannableSourceFile(file)) filesToScan.push(file);
      }
    }
    const usages = extractUsagesFromFiles(filesToScan);

    const violations: ConformanceViolation[] = [];
    for (const [name, files] of usages) {
      if (documented.has(name) || ignore.has(name)) continue;
      const examples = [...files].slice(0, 3).join(', ');
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

function failure(message: string) {
  return {
    severity: 'high' as const,
    details: { violations: [{ message, file: DOCS_PATH }] },
  };
}

function isScannableSourceFile(file: string): boolean {
  if (!SCANNABLE_EXT.test(file)) return false;
  if (TEST_FILE.test(file)) return false;
  if (EXCLUDED_SEGMENT.test(file)) return false;
  return true;
}

function extractUsagesFromFiles(files: string[]): Map<string, Set<string>> {
  const usages = new Map<string, Set<string>>();
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(join(workspaceRoot, file), 'utf-8');
    } catch {
      continue;
    }
    const isRust = file.endsWith('.rs');
    for (const name of extractUsedVarsFromContent(content, isRust)) {
      let set = usages.get(name);
      if (!set) {
        set = new Set();
        usages.set(name, set);
      }
      set.add(file);
    }
  }
  return usages;
}

export function extractDocumentedVars(mdocContent: string): Set<string> {
  return new Set(Array.from(mdocContent.matchAll(DOCS_TABLE_ROW), (m) => m[1]));
}

export function extractUsedVarsFromContent(
  content: string,
  isRust: boolean
): string[] {
  const patterns = isRust
    ? [RUST_ENV_VAR, RUST_ENV_MACRO, RUST_FROM_ENV]
    : [TS_JS_USAGE];
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const m of content.matchAll(pattern)) {
      found.push(m[1]);
    }
  }
  return found;
}
