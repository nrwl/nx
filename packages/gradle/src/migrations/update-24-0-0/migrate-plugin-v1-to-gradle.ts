import {
  applyChangesToString,
  ChangeType,
  ensurePackage,
  formatFiles,
  readNxJson,
  type StringChange,
  type Tree,
  updateNxJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import type { Node } from 'typescript';
import { addNxProjectGraphPlugin } from '../../generators/init/gradle-project-graph-plugin-utils';

const V1_PLUGIN = '@nx/gradle/plugin-v1';
const PLUGIN = '@nx/gradle';
// `@nx/gradle` reads the project graph from this Gradle plugin, which v1 never applied.
const GRADLE_PROJECT_GRAPH_VERSION = '0.1.25';
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
  '.js',
  '.cjs',
  '.mjs',
];

let ts: typeof import('typescript') | undefined;

export default async function update(tree: Tree) {
  const migratedRegistration = migrateNxJsonRegistrations(tree);
  const rewrittenFiles = rewriteSourceReferences(tree);

  if (!migratedRegistration && rewrittenFiles.length === 0) {
    return { skipAgentic: true };
  }

  if (migratedRegistration) {
    await addNxProjectGraphPlugin(tree, GRADLE_PROJECT_GRAPH_VERSION);
  }

  await formatFiles(tree);

  if (rewrittenFiles.length === 0) {
    return;
  }
  const message = `These files imported \`${V1_PLUGIN}\` and now import \`${PLUGIN}\`, whose targets and options differ from v1. Review them: ${rewrittenFiles.join(', ')}`;
  return { nextSteps: [message], agentContext: [message] };
}

function migrateNxJsonRegistrations(tree: Tree): boolean {
  const nxJson = readNxJson(tree);
  if (!nxJson?.plugins) {
    return false;
  }

  let changed = false;
  nxJson.plugins = nxJson.plugins.map((p) => {
    if (typeof p === 'string') {
      if (p !== V1_PLUGIN) {
        return p;
      }
      changed = true;
      return PLUGIN;
    }
    if (p.plugin !== V1_PLUGIN) {
      return p;
    }
    changed = true;
    p.plugin = PLUGIN;
    if (p.options && typeof p.options === 'object') {
      const options = p.options as Record<string, unknown>;
      if (options.ciTargetName !== undefined) {
        options.ciTestTargetName ??= options.ciTargetName;
        delete options.ciTargetName;
      }
      delete options.includeSubprojectsTasks;
    }
    return p;
  });

  if (changed) {
    updateNxJson(tree, nxJson);
  }
  return changed;
}

function rewriteSourceReferences(tree: Tree): string[] {
  const rewritten: string[] = [];
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!SOURCE_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original?.includes(V1_PLUGIN)) {
      return;
    }
    const updated = replaceV1StringLiterals(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      rewritten.push(filePath);
    }
  });
  return rewritten;
}

function replaceV1StringLiterals(source: string): string {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const changes: StringChange[] = [];
  const visit = (node: Node) => {
    if (
      (ts!.isStringLiteral(node) ||
        ts!.isNoSubstitutionTemplateLiteral(node)) &&
      node.text === V1_PLUGIN
    ) {
      // Skip the opening quote so the original quote style is kept.
      const start = node.getStart(sourceFile) + 1;
      changes.push(
        { type: ChangeType.Delete, start, length: node.getEnd() - start - 1 },
        { type: ChangeType.Insert, index: start, text: PLUGIN }
      );
    }
    node.forEachChild(visit);
  };
  sourceFile.forEachChild(visit);

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}
