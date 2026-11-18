import {
  getProjects,
  joinPathFragments,
  readNxJson,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type TargetDefaults,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
  resolveCommandSyntacticSugar,
  resolveNxTokensInOptions,
} from '@nx/devkit/internal';
import { load } from '@zkochan/js-yaml';
import {
  compatibleDefaultsEntries,
  selectDefaultsKey,
  type MatchedTargetRef,
} from '../../utils/target-defaults-matching';

const VERDACCIO_EXECUTOR = '@nx/js:verdaccio';

// The groups Verdaccio gives a user that is not logged in
const ANONYMOUS_GROUPS = new Set(['$all', '$anonymous', '@all', '@anonymous']);

const JWT_SECURITY_BLOCK = `# jwt tokens make verdaccio 7+ treat the placeholder npm auth token set by nx
# as anonymous instead of rejecting it
security:
  api:
    jwt:
      sign:
        expiresIn: 7d
`;

const MANUAL_STEP =
  'To let Verdaccio 7+ accept the placeholder npm auth token that Nx sets, set `security.api.jwt.sign.expiresIn` (for example to `7d`) in it.';

export default async function addVerdaccioJwtSecurity(tree: Tree) {
  const nextSteps: string[] = [];

  for (const path of findVerdaccioConfigPaths(tree)) {
    if (!tree.exists(path)) continue;
    const content = tree.read(path, 'utf-8');

    const config = parseYamlMap(content);
    if (!config) {
      nextSteps.push(`Could not parse ${path}. ${MANUAL_STEP}`);
      continue;
    }
    if (acceptsPlaceholderToken(config)) continue;
    if (reliesOnLoggedInUsers(config)) {
      nextSteps.push(
        `${path} relies on logged-in users, so it was not changed. On Verdaccio 7+, npm and bun need a token from \`npm login\` to publish to it. Setting \`security.api.jwt\` would let them publish packages open to anonymous users with the placeholder npm auth token that Nx sets. It would also make existing tokens from \`npm login\` stop working until users log in again.`
      );
      continue;
    }
    if ('security' in config) {
      nextSteps.push(
        `${path} already has a \`security\` section, so it was not changed. ${MANUAL_STEP}`
      );
      continue;
    }

    const updated = `${content}${content.endsWith('\n') ? '' : '\n'}\n${JWT_SECURITY_BLOCK}`;
    // Appending breaks configs written as a single flow mapping
    if (!parseYamlMap(updated)?.security?.api?.jwt?.sign) {
      nextSteps.push(`Could not update ${path}. ${MANUAL_STEP}`);
      continue;
    }
    tree.write(path, updated);
  }

  return nextSteps.length
    ? { nextSteps, agentContext: nextSteps }
    : { skipAgentic: true };
}

function findVerdaccioConfigPaths(tree: Tree): Set<string> {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  const paths = new Set<string>();

  for (const [projectName, project] of getProjects(tree)) {
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: project.projectType === 'application' ? 'app' : 'lib',
      data: project,
    };
    for (const [targetName, projectTarget] of Object.entries(
      project.targets ?? {}
    )) {
      try {
        const target = resolveTarget(
          { targetName, projectName, projectNode, target: projectTarget },
          targetDefaults
        );
        if (target.executor !== VERDACCIO_EXECUTOR) continue;

        for (const options of [
          target.options,
          ...Object.values(target.configurations ?? {}),
        ]) {
          if (typeof options?.config !== 'string') continue;
          const { config } = resolveNxTokensInOptions(
            { config: options.config },
            project,
            `${projectName}:${targetName}`
          );
          paths.add(joinPathFragments(config));
        }
      } catch {
        // Project graph creation fails on targets that cannot be resolved, so no task reads them
      }
    }
  }

  return paths;
}

// Like project graph creation: `command` means nx:run-commands, defaults entries incompatible
// with the target are dropped, and the rest merge in order, so an incompatible one replaces earlier ones
function resolveTarget(
  ref: Omit<MatchedTargetRef, 'matcherExecutor'>,
  targetDefaults: TargetDefaults | undefined
): TargetConfiguration {
  const root = ref.projectNode.data.root;
  const target = resolveCommandSyntacticSugar(ref.target, root);
  const matchedRef: MatchedTargetRef = {
    ...ref,
    target,
    matcherExecutor: target.executor,
  };
  const key = targetDefaults
    ? selectDefaultsKey(matchedRef, targetDefaults, target.executor)
    : null;

  let defaults: TargetConfiguration | undefined;
  for (const entry of compatibleDefaultsEntries(
    matchedRef,
    key,
    targetDefaults
  )) {
    // The reader merges a key's entries without resolving `command`, so read one at a time
    const matched = readTargetDefaultsForTarget(
      ref.targetName,
      { [key]: [entry] },
      target.executor,
      { projectName: ref.projectName, projectNode: ref.projectNode }
    );
    if (matched) {
      defaults = mergeTargetConfigurations(
        resolveCommandSyntacticSugar(matched, root),
        defaults
      );
    }
  }
  return defaults ? mergeTargetConfigurations(target, defaults) : target;
}

// Verdaccio 7+ rejects undecodable tokens only while `security.api.legacy` is on and `jwt` is unset
function acceptsPlaceholderToken(config: Record<string, any>): boolean {
  return (
    config.security?.api?.jwt != null || config.security?.api?.legacy === false
  );
}

// jwt tokens make existing login tokens anonymous, which can lose access under these configs
function reliesOnLoggedInUsers(config: Record<string, any>): boolean {
  if (config.publish?.check_owners === true) return true;
  // Auth plugins other than htpasswd can grant access or parse tokens their own way
  if (
    config.auth &&
    typeof config.auth === 'object' &&
    Object.keys(config.auth).some((plugin) => plugin !== 'htpasswd')
  ) {
    return true;
  }
  return Object.values(config.packages ?? {}).some(
    (rule: any) =>
      rule &&
      typeof rule === 'object' &&
      ['access', 'publish', 'unpublish', 'stage'].some((action) => {
        // An empty list denies everyone, and empty `unpublish` or `stage` falls back to `publish`
        const groups = normalizeGroups(rule[action]);
        return (
          groups.length > 0 &&
          !groups.some((group) => ANONYMOUS_GROUPS.has(group))
        );
      })
  );
}

function normalizeGroups(groups: unknown): string[] {
  if (typeof groups === 'string') return groups.split(/\s+/).filter(Boolean);
  return Array.isArray(groups) ? groups.map(String) : [];
}

function parseYamlMap(content: string): Record<string, any> | undefined {
  try {
    const value = load(content);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : undefined;
  } catch {
    return undefined;
  }
}
