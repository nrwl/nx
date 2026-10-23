import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readJson,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { join } from 'path';
import { intersects, lt, minVersion, validRange } from 'semver';
import { ensureTypescriptForNestSchematics } from '../../utils/ensure-typescript-for-schematics';
import {
  configureJestForEsmOnlyNestJs,
  jestNodeFloor,
} from '../../utils/unit-test-runner';
import { nxVersion } from '../../utils/versions';

// Keep these versions pinned; versions.ts advances to later majors.
// 12.0.0 shipped with its peers still on ^11.
const NEST_12_VERSIONS: Record<string, string> = {
  '@nestjs/common': '^12.0.1',
  '@nestjs/core': '^12.0.1',
  '@nestjs/microservices': '^12.0.1',
  '@nestjs/platform-express': '^12.0.1',
  '@nestjs/platform-fastify': '^12.0.1',
  '@nestjs/platform-socket.io': '^12.0.1',
  '@nestjs/platform-ws': '^12.0.1',
  '@nestjs/schematics': '^12.0.1',
  '@nestjs/testing': '^12.0.1',
  '@nestjs/websockets': '^12.0.1',
};
const JEST_CONFIG_FILES = [
  'jest.config.ts',
  'jest.config.cts',
  'jest.config.mts',
  'jest.config.js',
  'jest.config.cjs',
  'jest.config.mjs',
];
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const NEST_IMPORT = /(?:from\s+|require\(\s*|import\(\s*)['"]@nestjs\//;
const RERUN_COMMAND = `npx nx migrate @nx/nest@${nxVersion} --from=@nx/nest@24.0.0 --include=all && npx nx migrate --run-migration=@nx/nest:upgrade-to-nest-12`;

type MigrationResult = {
  nextSteps: string[];
  agentContext: string[];
  skipAgentic?: boolean;
};

export default async function upgradeToNest12(
  tree: Tree
): Promise<MigrationResult> {
  const jestProjects = findJestTestedNestProjects(tree);
  const oldNode = findNodeVersionsBelowJestFloor(tree);
  if (jestProjects.length > 0 && oldNode.length > 0) {
    return {
      nextSteps: [
        `Kept NestJS 11: Jest loads NestJS 12 only on Node.js ${jestNodeFloor} or later, and ${oldNode.join(
          ', '
        )}. These projects test Nest code with Jest: ${jestProjects.join(
          ', '
        )}. Move their tests to Vitest, or run them on Node.js ${jestNodeFloor}+, then run \`${RERUN_COMMAND}\` to move to NestJS 12.`,
      ],
      agentContext: [],
      skipAgentic: true,
    };
  }

  const declared = readJson(tree, 'package.json');
  const bumped = Object.fromEntries(
    Object.entries(NEST_12_VERSIONS).filter(
      ([name]) =>
        declared.devDependencies?.[name] || declared.dependencies?.[name]
    )
  );
  addDependenciesToPackageJson(tree, {}, bumped);
  ensureTypescriptForNestSchematics(tree);
  for (const project of jestProjects) {
    configureJestForEsmOnlyNestJs(tree, project);
  }
  await formatFiles(tree);

  return {
    nextSteps: [],
    agentContext: [
      `Bumped ${Object.entries(bumped)
        .map(([name, version]) => `\`${name}\` to \`${version}\``)
        .join(', ')} in package.json`,
      jestProjects.length > 0
        ? `These projects test Nest code with Jest, which needs Node.js ${jestNodeFloor}+ on NestJS 12; their Jest target now runs with NODE_OPTIONS=--experimental-vm-modules and Jest is on ^30.5.0: ${jestProjects.join(
            ', '
          )}`
        : 'No project tests Nest code with Jest',
    ],
  };
}

function findJestTestedNestProjects(tree: Tree): string[] {
  const projects: string[] = [];
  for (const [name, project] of getProjects(tree)) {
    const usesJest =
      JEST_CONFIG_FILES.some((file) => tree.exists(join(project.root, file))) ||
      Object.values(project.targets ?? {}).some(
        (target) => target.executor === '@nx/jest:jest'
      );
    if (usesJest && importsNest(tree, project.root)) {
      projects.push(name);
    }
  }
  return projects.sort();
}

function importsNest(tree: Tree, root: string): boolean {
  let found = false;
  visitNotIgnoredFiles(tree, root, (path) => {
    if (!found && SOURCE_FILE.test(path)) {
      found = NEST_IMPORT.test(tree.read(path, 'utf-8') ?? '');
    }
  });
  return found;
}

// Each Node.js version the workspace can be seen to run that is below the
// Jest floor, described for the next steps. CI configuration is left to the
// AI instructions.
function findNodeVersionsBelowJestFloor(tree: Tree): string[] {
  const found: string[] = [];
  const current = process.versions.node;
  if (lt(current, jestNodeFloor)) {
    found.push(`this migration runs on Node.js ${current}`);
  }
  // Version managers resolve a partial version like `24` to the latest match.
  for (const file of ['.nvmrc', '.node-version']) {
    const pinned = tree.exists(file) ? tree.read(file, 'utf-8').trim() : '';
    if (
      validRange(pinned) &&
      !intersects(pinned, `>=${jestNodeFloor}`, { includePrerelease: true })
    ) {
      found.push(`\`${file}\` pins Node.js ${pinned}`);
    }
  }
  const engines = readJson(tree, 'package.json').engines?.node;
  const enginesFloor =
    typeof engines === 'string' && validRange(engines)
      ? minVersion(engines)
      : null;
  if (enginesFloor && lt(enginesFloor, jestNodeFloor)) {
    found.push(`\`engines.node\` allows Node.js ${enginesFloor.version}`);
  }
  return found;
}
