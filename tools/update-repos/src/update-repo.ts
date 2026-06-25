#!/usr/bin/env ts-node

import { execSync, exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RepositoryConfig {
  repo: string;
  branch: string;
  packageManager: string;
}

interface Config {
  repositories: Record<string, RepositoryConfig>;
}

interface PullRequestInfo {
  repoName: string;
  title: string;
  description: string;
  url: string;
}

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

const SCRIPT_DIR = __dirname;
const REPOS_DIR = path.join(os.tmpdir(), 'updating-nx', 'repos');
// Compiled to tools/update-repos/dist/src, so the package root is two levels up.
const CONFIG_FILE = path.join(SCRIPT_DIR, '..', '..', 'config', 'repos.json');

function log(message: string) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`${timestamp} [UPDATE] ${message}`);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function execWithOutput(
  command: string,
  cwd: string,
  description?: string,
  env?: NodeJS.ProcessEnv
): Promise<void> {
  if (description) {
    log(`🔄 ${description}`);
  }
  const finalCommand = command.startsWith('mise ')
    ? command
    : `mise exec -- ${command}`;
  log(`📝 Running: ${finalCommand}`);

  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', finalCommand], {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : undefined,
    });

    child.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`   ${output}`);
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`   ⚠️  ${output}`);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ Completed: ${description || command}`);
        resolve();
      } else {
        log(`❌ Failed: ${description || command} (exit code ${code})`);
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      }
    });

    child.on('error', (error) => {
      log(`❌ Error: ${error.message}`);
      reject(error);
    });
  });
}

function detectPackageManager(repoDir: string): PackageManager {
  if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  } else if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
    return 'yarn';
  } else if (fs.existsSync(path.join(repoDir, 'bun.lockb'))) {
    return 'bun';
  } else if (fs.existsSync(path.join(repoDir, 'package-lock.json'))) {
    return 'npm';
  } else {
    return 'npm'; // default fallback
  }
}

function getInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
    case 'npm':
    default:
      return 'npm install';
  }
}

function getMigrateCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm exec nx migrate next';
    case 'yarn':
      return 'yarn nx migrate next';
    case 'bun':
      return 'bun nx migrate next';
    case 'npm':
    default:
      return 'npx nx migrate next';
  }
}

function getRunMigrationsCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm exec nx migrate --run-migrations --create-commits --agentic';
    case 'yarn':
      return 'yarn nx migrate --run-migrations --create-commits --agentic';
    case 'bun':
      return 'bun nx migrate --run-migrations --create-commits --agentic';
    case 'npm':
    default:
      return 'npx nx migrate --run-migrations --create-commits --agentic';
  }
}

function getResetCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm exec nx reset';
    case 'yarn':
      return 'yarn nx reset';
    case 'bun':
      return 'bun nx reset';
    case 'npm':
    default:
      return 'npx nx reset';
  }
}

function getPostUpdateCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm run post-nx-update';
    case 'yarn':
      return 'yarn run post-nx-update';
    case 'bun':
      return 'bun run post-nx-update';
    case 'npm':
    default:
      return 'npm run post-nx-update';
  }
}

async function runPostUpdateScript(
  repoDir: string,
  packageManager: PackageManager
): Promise<boolean> {
  try {
    // Check if package.json exists and has post-nx-update script
    const packageJsonPath = path.join(repoDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!packageJson.scripts || !packageJson.scripts['post-nx-update']) {
      log('📋 No post-nx-update script found, skipping');
      return false;
    }

    log('🔧 Found post-nx-update script, executing...');
    const postUpdateCmd = getPostUpdateCommand(packageManager);
    await execWithOutput(
      postUpdateCmd,
      repoDir,
      'Running post-nx-update script'
    );

    // Check if the script made any changes
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: repoDir,
    });
    if (stdout.trim()) {
      log('📝 Post-nx-update script made changes, committing...');
      await execWithOutput('git add .', repoDir, 'Staging post-update changes');
      await execWithOutput(
        'git commit -m "chore(repo): apply post-nx-update script changes"',
        repoDir,
        'Committing post-update changes'
      );
      return true;
    } else {
      log('📋 No changes from post-nx-update script');
      return false;
    }
  } catch (error) {
    log(
      `⚠️  Warning: Failed to run post-nx-update script: ${getErrorMessage(
        error
      )}`
    );
    return false;
  }
}

async function getNxVersion(
  repoDir: string,
  _packageManager: PackageManager
): Promise<string> {
  try {
    // Use Node.js to require nx package.json directly from the repo
    const command = `node -e "console.log(require('nx/package.json').version)"`;
    const { stdout } = await execAsync(command, { cwd: repoDir });
    return stdout.trim();
  } catch (error) {
    // Fallback: try to read from package.json
    try {
      const packageJsonPath = path.join(repoDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const version =
        packageJson.dependencies?.nx ||
        packageJson.devDependencies?.nx ||
        'unknown';

      // Clean up version string (remove ^ ~ etc.)
      if (version !== 'unknown') {
        const versionMatch = version.match(/(\d+\.\d+\.\d+(?:-[^\s]+)?)/);
        return versionMatch ? versionMatch[1] : version;
      }
      return version;
    } catch {
      return 'unknown';
    }
  }
}

function buildPullRequestInfo(
  repoName: string,
  updateBranch: string,
  fromVersion: string,
  toVersion: string
): PullRequestInfo {
  const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const repoConfig = config.repositories[repoName];
  const baseBranch = repoConfig.branch;

  const title = `chore(repo): update nx to ${toVersion}`;
  const description = `Updating Nx from ${fromVersion} to ${toVersion}`;

  // Build a GitHub "create pull request" URL with the title and body pre-filled.
  const params = new URLSearchParams({
    expand: '1',
    title,
    body: description,
  });
  const url = `https://github.com/${repoConfig.repo}/compare/${baseBranch}...${updateBranch}?${params.toString()}`;

  return { repoName, title, description, url };
}

function printPullRequestInfo(prInfo: PullRequestInfo): void {
  console.log('');
  console.log(`📦 ${prInfo.repoName}`);
  console.log(`   Title:       ${prInfo.title}`);
  console.log(`   Description: ${prInfo.description}`);
  console.log(`   Open PR:     ${prInfo.url}`);
}

async function checkRequiredTools(): Promise<void> {
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'GitHub CLI (gh) is required but not installed. Please install gh to continue.'
    );
  }
}

async function setupRepository(
  repoName: string,
  repoIdentifier: string,
  repoBranch: string
): Promise<void> {
  const cloneDir = path.join(REPOS_DIR, repoName);

  log(`Setting up repository: ${repoName}...`);

  // If directory already exists, assume it's already setup and skip
  if (fs.existsSync(cloneDir)) {
    log(`Repository ${repoName} already exists at ${cloneDir}, skipping setup`);
    return;
  }

  try {
    // Clone repository using gh cli with specific branch
    log(
      `Cloning ${repoName} from ${repoIdentifier} (branch: ${repoBranch})...`
    );
    await execAsync(
      `gh repo clone "${repoIdentifier}" "${cloneDir}" -- --depth 1 --branch "${repoBranch}"`
    );

    log(`Repository ${repoName} cloned successfully at ${cloneDir}`);
  } catch (error) {
    throw new Error(
      `Failed to setup repository ${repoName}: ${getErrorMessage(error)}`
    );
  }
}

async function updateRepository(repoName: string): Promise<PullRequestInfo> {
  const repoDir = path.join(REPOS_DIR, repoName);

  log(`Starting update for repository: ${repoName}`);

  // Get configuration for this repo
  const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const repoConfig = config.repositories[repoName];

  // Check required tools
  await checkRequiredTools();

  // Create repos directory if it doesn't exist
  if (!fs.existsSync(REPOS_DIR)) {
    log(`Creating repos directory: ${REPOS_DIR}`);
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  // Setup repository if it doesn't exist (noop if already exists)
  await setupRepository(repoName, repoConfig.repo, repoConfig.branch);

  // Verify repository directory exists after setup
  if (!fs.existsSync(repoDir)) {
    throw new Error(
      `Repository directory still not found after setup: ${repoDir}`
    );
  }

  try {
    const mainBranch = repoConfig.branch;

    // Fetch latest changes from remote
    await execWithOutput(
      'git fetch origin',
      repoDir,
      'Fetching latest changes from remote'
    );

    // Create and checkout update branch from remote main branch
    const updateBranch = 'upnx';
    await execWithOutput(
      `git checkout -B ${updateBranch} origin/${mainBranch}`,
      repoDir,
      `Creating update branch '${updateBranch}' from origin/${mainBranch}`
    );

    // Trust mise config if present so correct tool versions are used
    const miseToml = path.join(repoDir, 'mise.toml');
    const dotMiseToml = path.join(repoDir, '.mise.toml');
    if (fs.existsSync(miseToml) || fs.existsSync(dotMiseToml)) {
      await execWithOutput(
        'mise trust',
        repoDir,
        'Trusting mise configuration'
      );
      await execWithOutput(
        'mise install',
        repoDir,
        'Installing mise-managed tools'
      );
    }

    // Detect package manager
    const detectedPm = detectPackageManager(repoDir);
    log(`🔍 Detected package manager: ${detectedPm}`);

    const packageManager =
      (repoConfig?.packageManager as PackageManager) || detectedPm;
    log(`⚙️  Using package manager: ${packageManager}`);

    // Install dependencies
    const installCmd = getInstallCommand(packageManager);
    await execWithOutput(installCmd, repoDir, 'Installing dependencies');

    // Get initial Nx version before migration
    const fromVersion = await getNxVersion(repoDir, packageManager);
    log(`📦 Current Nx version: ${fromVersion}`);

    // Run nx migrate with the next version of the migrate CLI itself
    const migrateCmd = getMigrateCommand(packageManager);
    await execWithOutput(
      migrateCmd,
      repoDir,
      'Running Nx migration to next version',
      { NX_MIGRATE_CLI_VERSION: 'next' }
    );

    // Install updated dependencies to get the new Nx version
    await execWithOutput(
      installCmd,
      repoDir,
      'Installing updated dependencies with new Nx version'
    );

    // Check if migrations.json was created
    const migrationsFile = path.join(repoDir, 'migrations.json');
    let toVersion: string;

    // Get the updated Nx version after installing new dependencies
    toVersion = await getNxVersion(repoDir, packageManager);
    log(`📦 Updated Nx version: ${toVersion}`);

    // Commit the initial migration setup (package.json, migrations.json)
    await execWithOutput('git add .', repoDir, 'Staging migration setup files');
    await execWithOutput(
      `git commit -m "chore(repo): update nx to ${toVersion}"`,
      repoDir,
      'Committing migration setup'
    );

    if (fs.existsSync(migrationsFile)) {
      log(
        '📋 migrations.json found, running migrations with automatic commits...'
      );

      // Run migrations with --create-commits flag (Nx will create commits automatically)
      const runMigrationsCmd = getRunMigrationsCommand(packageManager);
      await execWithOutput(
        runMigrationsCmd,
        repoDir,
        'Applying Nx migrations (auto-commits enabled)',
        { NX_MIGRATE_CLI_VERSION: 'next' }
      );

      // Clean up migrations.json after successful migration
      if (fs.existsSync(migrationsFile)) {
        log('🧹 Cleaning up migrations.json after successful migration');
        fs.unlinkSync(migrationsFile);

        // Commit the removal of migrations.json if there are any changes
        try {
          await execWithOutput(
            'git add .',
            repoDir,
            'Staging migration cleanup'
          );
          await execWithOutput(
            'git commit -m "chore(repo): clean up migrations.json after migration"',
            repoDir,
            'Committing migration cleanup'
          );
        } catch (error) {
          // It's okay if there's nothing to commit
          log('📋 No additional cleanup needed');
        }
      }

      log('✅ Nx migrations completed with automatic commits');
    } else {
      log('📋 No migrations.json found, migration setup complete');
    }

    // Run post-nx-update script if it exists
    await runPostUpdateScript(repoDir, packageManager);

    // Reset Nx cache to avoid prepush hook issues
    const resetCmd = getResetCommand(packageManager);
    await execWithOutput(
      resetCmd,
      repoDir,
      'Resetting Nx cache to avoid prepush hook issues'
    );

    // Push the update branch first
    await execWithOutput(
      `git push -u origin ${updateBranch} --force --no-verify`,
      repoDir,
      'Pushing update branch to remote (force, skipping hooks)'
    );

    // Build the pull request URL (PRs are created manually from this URL)
    const prInfo = buildPullRequestInfo(
      repoName,
      updateBranch,
      fromVersion,
      toVersion
    );

    log(`✅ Update completed successfully for ${repoName}`);
    return prInfo;
  } catch (error) {
    throw new Error(`Failed to update ${repoName}: ${getErrorMessage(error)}`);
  }
}

function printPullRequestSummary(prInfos: PullRequestInfo[]): void {
  if (prInfos.length === 0) {
    return;
  }
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(' Pull request(s) to create');
  console.log('═══════════════════════════════════════════════');
  prInfos.forEach(printPullRequestInfo);
  console.log('');
}

async function updateAllRepositories(): Promise<void> {
  const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const repoNames = Object.keys(config.repositories);

  log('Starting concurrent updates for all repositories...');

  const results = await Promise.allSettled(
    repoNames.map((repoName) => updateRepository(repoName))
  );

  const prInfos: PullRequestInfo[] = [];
  const failures: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      prInfos.push(result.value);
    } else {
      const repoName = repoNames[index];
      log(`ERROR updating ${repoName}: ${getErrorMessage(result.reason)}`);
      failures.push(repoName);
    }
  });

  // Print the PR URLs for the repos that updated successfully.
  printPullRequestSummary(prInfos);

  if (failures.length > 0) {
    throw new Error(`Failed to update: ${failures.join(', ')}`);
  }

  log('All repositories updated successfully!');
}

async function main(): Promise<void> {
  const repoName = process.argv[2];

  try {
    // Check if config file exists
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error(`Configuration file not found at ${CONFIG_FILE}`);
    }

    const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    if (!repoName) {
      // No repo specified, update all repositories concurrently
      await updateAllRepositories();
    } else {
      // Check if repository exists in config
      if (!config.repositories[repoName]) {
        log(`ERROR: Repository '${repoName}' not found in configuration`);
        log('Available repositories:');
        Object.keys(config.repositories).forEach((name) => log(`  - ${name}`));
        process.exit(1);
      }

      const prInfo = await updateRepository(repoName);
      printPullRequestSummary([prInfo]);
    }
  } catch (error) {
    log(`ERROR: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
