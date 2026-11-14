import { formatChangedFiles } from '../../generators/internal-utils/format-changed-files';
import type { Tree } from '../../generators/tree';
import { readJson, updateJson } from '../../generators/utils/json';
import { readNxJson } from '../../generators/utils/nx-json';
import { getProjects } from '../../generators/utils/project-configuration';
import { readTargetDefaultsForTarget } from '../../project-graph/utils/project-configuration/target-defaults';
import { createGitIgnoreChecker } from '../../utils/ignore';
import { nxVersion } from '../../utils/versions';

const POWERPACK_CONFORMANCE = '@nx/powerpack-conformance';
const CONFORMANCE = '@nx/conformance';
const OWNERS = '@nx/owners';
const BUNDLE_RULES_EXECUTOR = '@nx/conformance:bundle-rules';
const ESBUILD_VERSION = '^0.25.0';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

// A quoted `@nx/powerpack-conformance` specifier, executor or rule, e.g.
// `"@nx/powerpack-conformance:bundle-rules"` or `'@nx/powerpack-conformance/ensure-owners'`
const SPECIFIER = /(["'`])@nx\/powerpack-conformance([:/][^"'`]*)?\1/g;

export default async function replacePowerpackConformance(tree: Tree) {
  if (
    !tree.exists('package.json') ||
    !declaresDependency(readJson(tree, 'package.json'), POWERPACK_CONFORMANCE)
  ) {
    return { skipAgentic: true };
  }

  let movedEnsureOwners = false;
  const rewrite = (content: string) =>
    content.replace(SPECIFIER, (_, quote: string, rest = '') => {
      if (rest === '/ensure-owners') {
        movedEnsureOwners = true;
        return `${quote}${OWNERS}/ensure-owners${quote}`;
      }
      return `${quote}${CONFORMANCE}${rest}${quote}`;
    });

  for (const path of filesToRewrite(tree)) {
    if (path === 'package.json' || path.endsWith('/package.json')) {
      updateJson(tree, path, replaceDependency);
    }
    const content = tree.read(path, 'utf-8');
    const updated = rewrite(content);
    if (updated !== content) {
      tree.write(path, updated);
    }
  }

  updateJson(tree, 'package.json', (json) => {
    if (movedEnsureOwners && !declaresDependency(json, OWNERS)) {
      addDevDependency(json, OWNERS, nxVersion);
    }
    if (usesBundleRules(tree) && !declaresDependency(json, 'esbuild')) {
      addDevDependency(json, 'esbuild', ESBUILD_VERSION);
    }
    return json;
  });

  await formatChangedFiles(tree);
  return { skipAgentic: true };
}

function filesToRewrite(tree: Tree): string[] {
  const isIgnored = createGitIgnoreChecker(tree);
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const child of tree.children(dir)) {
      const path = dir ? `${dir}/${child}` : child;
      if (tree.isFile(path)) {
        if (
          (child === 'package.json' ||
            child === 'project.json' ||
            child === 'nx.json' ||
            SOURCE_FILE.test(child)) &&
          !isIgnored.isIgnoredFile(path)
        ) {
          files.push(path);
        }
      } else if (!isIgnored.isIgnoredDirectory(path)) {
        visit(path);
      }
    }
  };
  visit('');
  return files;
}

// Swaps the dependency for @nx/conformance at the current Nx version, since the
// two packages were versioned separately
function replaceDependency(json: Record<string, any>) {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = json[field];
    if (!dependencies?.[POWERPACK_CONFORMANCE]) {
      continue;
    }
    delete dependencies[POWERPACK_CONFORMANCE];
    if (!declaresDependency(json, CONFORMANCE)) {
      dependencies[CONFORMANCE] = nxVersion;
    }
  }
  return json;
}

function declaresDependency(json: Record<string, any>, name: string): boolean {
  return DEPENDENCY_FIELDS.some((field) => Boolean(json[field]?.[name]));
}

function addDevDependency(
  json: Record<string, any>,
  name: string,
  version: string
) {
  json.devDependencies = { ...json.devDependencies, [name]: version };
}

function usesBundleRules(tree: Tree): boolean {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  for (const [, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      const executor =
        target.executor ??
        readTargetDefaultsForTarget(targetName, targetDefaults)?.executor;
      if (executor === BUNDLE_RULES_EXECUTOR) {
        return true;
      }
    }
  }
  return false;
}
