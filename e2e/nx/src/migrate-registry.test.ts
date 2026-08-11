import { renameSync, rmSync } from 'node:fs';
import {
  cleanupProject,
  directoryExists,
  e2eCwd,
  fileExists,
  getPublishedVersion,
  getSelectedPackageManager,
  newProject,
  readFile,
  runCLI,
  runCommand,
  tmpBackupProjPath,
  tmpProjPath,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

// A closed port, so anything migrate resolves came from a registry it was
// pointed at rather than from a host that happens to answer.
const unreachableRegistry = 'http://localhost:1/';
// corepack blocks on a confirmation prompt before downloading a version it does
// not already have.
const corepackEnv = { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
const yarnClassicVersion = '1.22.22';
const yarnBerryVersion = '4.0.2';
// From the pnpm major that reads its own PNPM_CONFIG_* prefix instead of
// npm_config_*, so the bridged overlay reaches `npm pack` but not `pnpm view`.
const pnpmVersionIgnoringNpmConfigEnv = '11.2.2';

const migrateEnv = {
  NX_MIGRATE_SKIP_INSTALL: 'true',
  NX_MIGRATE_USE_LOCAL: 'true',
  NX_SKIP_PROVENANCE_CHECK: 'true',
  // The registry fetch only reports its failure through the verbose log.
  NX_VERBOSE_LOGGING: 'true',
};

let localRegistry: string;

function applyEnv(
  entries: readonly (readonly [string, string | undefined])[]
): void {
  for (const [key, value] of entries) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Applies process-level environment overrides, deleting the keys mapped to
 * undefined, and returns the undo. Going through this rather than assigning the
 * captured values back matters for a key that was absent: assignment writes the
 * string "undefined", which the next workspace then resolves as a registry.
 */
function overrideEnv(entries: Record<string, string | undefined>): () => void {
  const previous = Object.keys(entries).map(
    (key) => [key, process.env[key]] as const
  );
  applyEnv(Object.entries(entries));
  return () => applyEnv(previous);
}

/**
 * Runs `nx migrate` twice against the same file, first with the closed port in
 * it and then with the local registry, so the run that succeeds can only have
 * read that file. Declaring the closed port rather than leaving the file out
 * keeps the failing half from being carried by a lower configuration tier, and
 * still catches an ambient variable naming a reachable registry, which outranks
 * the file in every package manager here and would keep both halves passing.
 */
function expectRegistryTakenFromPackageManagerConfig(
  declareRegistry: (registry: string) => void,
  env: Record<string, string>,
  packageName = 'nx'
): void {
  const version = getPublishedVersion();
  const command = `migrate ${packageName}@${version}`;
  const registryFailure = `Failed to get migrations from registry for ${packageName}@${version}`;

  declareRegistry(unreachableRegistry);
  const withUnreachableRegistry = runCLI(command, {
    env,
    silenceError: true,
    redirectStderr: true,
  });
  expect(withUnreachableRegistry).toContain(registryFailure);

  declareRegistry(localRegistry);
  const withLocalRegistry = runCLI(command, { env, redirectStderr: true });
  expect(withLocalRegistry).not.toContain(registryFailure);
  expect(withLocalRegistry).toContain(`Fetching ${packageName}@${version}`);
}

// npm has no tier for a package-manager-only config file, so pinning the closed
// port in .npmrc leaves the package manager's own file as the only place a
// working registry can come from.
function pinNpmrcToUnreachableRegistry(): void {
  updateFile('.npmrc', (content) =>
    [
      content.trimEnd(),
      `registry=${unreachableRegistry}`,
      'fetch-retries=0',
    ].join('\n')
  );
}

function readPristine(file: string): string {
  return fileExists(tmpProjPath(file)) ? `${readFile(file).trimEnd()}\n` : '';
}

/**
 * The workspace is created by whichever version the machine happens to run, and
 * which of a package manager's configuration files nx reads depends on it.
 * Returns the undo, so a case that pins a version hands the workspace back as
 * it found it rather than leaving the pin to whatever runs next.
 */
function pinPackageManager(pin: string): () => void {
  let previous: string | undefined;
  updateJson('package.json', (json) => {
    previous = json.packageManager;
    return { ...json, packageManager: pin };
  });
  expect(
    runCommand(`${pin.split('@')[0]} --version`, {
      env: corepackEnv,
      failOnError: true,
    }).trim()
  ).toEqual(pin.split('@')[1]);

  return () =>
    updateJson('package.json', ({ packageManager, ...json }) =>
      previous === undefined ? json : { ...json, packageManager: previous }
    );
}

// Creating a workspace runs whichever yarn corepack currently defaults to, and
// that default is machine-wide state a previous run of this file also wrote.
function activateYarn(version: string): void {
  runCommand(`corepack prepare yarn@${version} --activate`, {
    cwd: e2eCwd,
    env: corepackEnv,
    failOnError: true,
  });
}

/**
 * Berry cannot take over a workspace yarn classic created: importing a classic
 * lockfile re-resolves the whole tree and that resolution fails. So berry has
 * to create its own, and workspace backups are keyed on the package manager
 * name alone, which puts both yarns in one slot. Hand the classic one back
 * before anything else asks for yarn and gets berry.
 */
function createYarnBerryProject(): void {
  const backup = tmpBackupProjPath('yarn');
  const classicBackup = `${backup}-classic`;

  if (directoryExists(backup)) {
    renameSync(backup, classicBackup);
  }
  try {
    activateYarn(yarnBerryVersion);
    newProject({ packageManager: 'yarn', packages: [] });
  } finally {
    rmSync(backup, { recursive: true, force: true });
    if (directoryExists(classicBackup)) {
      renameSync(classicBackup, backup);
    }
  }
}

// Each describe installs and pins the package manager it exercises, so the
// matrix leg's own choice changes nothing about what runs. Pinning the suite to
// the one leg every OS has keeps it from repeating identical work per manager.
const suite = getSelectedPackageManager() === 'npm' ? describe : describe.skip;

suite('migrate registry configuration', () => {
  let previousPackageManager: string;

  beforeAll(() => {
    localRegistry = process.env.npm_config_registry;
    previousPackageManager = process.env.SELECTED_PM;
  });

  afterAll(() => {
    applyEnv([['SELECTED_PM', previousPackageManager]]);
  });

  describe('pnpm', () => {
    const workspaceFile = 'pnpm-workspace.yaml';
    let restoreEnv: () => void;
    let pristineWorkspaceFile: string;

    beforeAll(() => {
      // PR runs pin the whole suite to npm, and the configuration under test is
      // pnpm's.
      process.env.SELECTED_PM = 'pnpm';
      newProject({ packageManager: 'pnpm', packages: [] });
      pinNpmrcToUnreachableRegistry();
      pristineWorkspaceFile = readPristine(workspaceFile);

      // The harness exports the local registry through this, and pnpm takes it
      // over anything a file declares.
      restoreEnv = overrideEnv({ pnpm_config_registry: undefined });
    }, 600_000);

    afterAll(() => {
      restoreEnv?.();
      cleanupProject();
    });

    const declareRegistry = (registry: string) =>
      updateFile(
        workspaceFile,
        `${pristineWorkspaceFile}registries:\n  default: ${registry}\n`
      );

    it('should resolve migrations through the registry pnpm-workspace.yaml declares', () => {
      expectRegistryTakenFromPackageManagerConfig(declareRegistry, {
        ...migrateEnv,
        npm_config_registry: unreachableRegistry,
      });
    });

    // Pinned for these cases only, and handed back afterwards: the version
    // decides which surfaces pnpm reads, so leaving it set would silently
    // rewrite what any case added after this one is testing.
    describe('on a pnpm that ignores npm_config_*', () => {
      let restorePin: () => void;

      // corepack downloads the pinned version on first use.
      beforeAll(() => {
        restorePin = pinPackageManager(
          `pnpm@${pnpmVersionIgnoringNpmConfigEnv}`
        );
      }, 300_000);

      afterAll(() => {
        restorePin?.();
      });

      it('should resolve migrations through the registry pnpm-workspace.yaml declares', () => {
        expectRegistryTakenFromPackageManagerConfig(declareRegistry, {
          ...migrateEnv,
          npm_config_registry: unreachableRegistry,
        });
      });
    });
  });

  // migrate re-invokes itself through the workspace package manager, and yarn
  // classic hands that child its whole configuration as npm_config_*, registry
  // included. So this passes on the code that predates the bridging too, and
  // what it pins is that the bridge agrees with the value yarn resolves: the
  // overlay is applied last, so a registry it got wrong would override yarn's.
  describe('yarn classic', () => {
    let restoreEnv: () => void;
    let pristineYarnrc: string;

    // Creating the workspace resolves and fetches its whole dependency tree,
    // which the suite-wide timeout does not cover.
    beforeAll(() => {
      process.env.SELECTED_PM = 'yarn';
      activateYarn(yarnClassicVersion);
      newProject({ packageManager: 'yarn', packages: [] });
      pinPackageManager(`yarn@${yarnClassicVersion}`);
      pinNpmrcToUnreachableRegistry();
      pristineYarnrc = readPristine('.yarnrc');

      restoreEnv = overrideEnv({ YARN_REGISTRY: undefined });
    }, 600_000);

    afterAll(() => {
      restoreEnv?.();
      cleanupProject();
    });

    it('should resolve migrations through the registry .yarnrc declares', () => {
      expectRegistryTakenFromPackageManagerConfig(
        (registry) =>
          updateFile('.yarnrc', `${pristineYarnrc}registry "${registry}"\n`),
        { ...migrateEnv, npm_config_registry: unreachableRegistry }
      );
    });
  });

  describe('yarn berry', () => {
    const yarnrcFile = '.yarnrc.yml';
    let restoreInstallEnv: () => void;
    let restoreEnv: () => void;
    let pristineYarnrcFile: string;

    // Creating the workspace resolves and fetches its whole dependency tree,
    // which the suite-wide timeout does not cover.
    beforeAll(() => {
      process.env.SELECTED_PM = 'yarn';
      // A workspace being created has no lockfile yet, which berry refuses to
      // install against once it sees CI.
      restoreInstallEnv = overrideEnv({
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
      });
      createYarnBerryProject();
      pinPackageManager(`yarn@${yarnBerryVersion}`);
      pinNpmrcToUnreachableRegistry();
      pristineYarnrcFile = readPristine(yarnrcFile);

      restoreEnv = overrideEnv({ YARN_NPM_REGISTRY_SERVER: undefined });
    }, 600_000);

    afterAll(() => {
      restoreEnv?.();
      restoreInstallEnv?.();
      cleanupProject();
      // Leave the machine-wide default on the version every other suite that
      // creates a yarn workspace assumes.
      activateYarn(yarnClassicVersion);
    });

    it('should resolve migrations through the registry .yarnrc.yml declares', () => {
      expectRegistryTakenFromPackageManagerConfig(
        (registry) =>
          updateFile(
            yarnrcFile,
            `${pristineYarnrcFile}npmRegistryServer: "${registry}"\n`
          ),
        { ...migrateEnv, npm_config_registry: unreachableRegistry }
      );
    });
  });

  // A bunfig registry sits below the global .npmrc in bun's own chain, so on a
  // machine that declares one there the file under test would never decide the
  // default registry. A scope is resolved on its own, which is what lets this
  // pin one without redirecting the home directory the rest of the run reads.
  describe('bun', () => {
    const bunfigFile = 'bunfig.toml';
    const scopedPackage = '@nx/js';
    let restoreEnv: () => void;
    let pristineBunfig: string;

    // Creating the workspace resolves and fetches its whole dependency tree,
    // which the suite-wide timeout does not cover.
    beforeAll(() => {
      process.env.SELECTED_PM = 'bun';
      newProject({ packageManager: 'bun', packages: [scopedPackage] });
      pinNpmrcToUnreachableRegistry();
      pristineBunfig = readPristine(bunfigFile);

      // The harness exports the local registry through this, and bun takes it
      // as the default registry, which the case below would then resolve the
      // scope from whether or not the file it declares reached npm.
      restoreEnv = overrideEnv({ BUN_CONFIG_REGISTRY: undefined });
    }, 600_000);

    afterAll(() => {
      restoreEnv?.();
      cleanupProject();
    });

    it('should resolve migrations through the registry bunfig.toml declares for the scope', () => {
      expectRegistryTakenFromPackageManagerConfig(
        (registry) =>
          updateFile(
            bunfigFile,
            // bun reads its cooldown out of this file and no other surface, so
            // a window left in the developer's own bunfig would hold back
            // everything the local registry just published.
            `${pristineBunfig}[install]\nminimumReleaseAge = 0\n\n` +
              `[install.scopes]\n"@nx" = "${registry}"\n`
          ),
        { ...migrateEnv, npm_config_registry: unreachableRegistry },
        scopedPackage
      );
    });
  });
});
