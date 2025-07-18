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

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

const SCRIPT_DIR = __dirname;
const REPOS_DIR = path.join(os.tmpdir(), 'updating-nx', 'repos');
const CONFIG_FILE = path.join(SCRIPT_DIR, '..', 'config', 'repos.json');

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
  description?: string
): Promise<void> {
  if (description) {
    log(`🔄 ${description}`);
  }
  log(`📝 Running: ${command}`);

  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
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
      return 'pnpm exec nx migrate --run-migrations --create-commits';
    case 'yarn':
      return 'yarn nx migrate --run-migrations --create-commits';
    case 'bun':
      return 'bun nx migrate --run-migrations --create-commits';
    case 'npm':
    default:
      return 'npx nx migrate --run-migrations --create-commits';
  }
}

async function getNxVersion(
  repoDir: string,
  packageManager: PackageManager
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
      const version = packageJson.dependencies?.nx ||
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

async function createPullRequest(
  repoName: string,
  repoDir: string,
  updateBranch: string,
  fromVersion: string,
  toVersion: string
): Promise<void> {
  try {
    const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const repoConfig = config.repositories[repoName];
    const baseBranch = repoConfig.branch;

    const title = `chore(repo): update nx to ${toVersion}`;
    const description = `Updating Nx from ${fromVersion} to ${toVersion}`;

    log(`Creating pull request: ${title}`);

    // Create PR using GitHub CLI
    const createPrCommand = `gh pr create --title "${title}" --body "${description}" --base ${baseBranch} --head ${updateBranch}`;
    const { stdout } = await execAsync(createPrCommand, { cwd: repoDir });

    const prUrl = stdout.trim();
    log(`Pull request created successfully: ${prUrl}`);

    // Open PR in browser
    log(`🌐 Opening pull request in browser...`);
    const openPrCommand = `gh pr view ${updateBranch} --web`;
    await execAsync(openPrCommand, { cwd: repoDir });
  } catch (error) {
    log(
      `Warning: Failed to create pull request for ${repoName}: ${getErrorMessage(
        error
      )}`
    );
    // Don't throw error here - PR creation failure shouldn't fail the entire update
  }
}

async function updateRepository(repoName: string): Promise<void> {
  const repoDir = path.join(REPOS_DIR, repoName);

  log(`Starting update for repository: ${repoName}`);

  // Check if repository directory exists, create parent directory if needed
  if (!fs.existsSync(repoDir)) {
    // Create parent directory if it doesn't exist
    if (!fs.existsSync(REPOS_DIR)) {
      log(`Creating repos directory: ${REPOS_DIR}`);
      fs.mkdirSync(REPOS_DIR, { recursive: true });
    }
    throw new Error(
      `Repository directory not found: ${repoDir}. Please run setup-repos.ts first`
    );
  }

  try {
    // Get configuration for this repo to know the main branch
    const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const repoConfig = config.repositories[repoName];
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

    // Run nx migrate
    const migrateCmd = getMigrateCommand(packageManager);
    await execWithOutput(
      migrateCmd,
      repoDir,
      'Running Nx migration to next version'
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
    await execWithOutput(
      'git add .',
      repoDir,
      'Staging migration setup files'
    );
    await execWithOutput(
      `git commit -m "chore(repo): update nx to ${toVersion}"`,
      repoDir,
      'Committing migration setup'
    );

    if (fs.existsSync(migrationsFile)) {
      log('📋 migrations.json found, running migrations with automatic commits...');

      // Run migrations with --create-commits flag (Nx will create commits automatically)
      const runMigrationsCmd = getRunMigrationsCommand(packageManager);
      await execWithOutput(runMigrationsCmd, repoDir, 'Applying Nx migrations (auto-commits enabled)');

      log('✅ Nx migrations completed with automatic commits');
    } else {
      log('📋 No migrations.json found, migration setup complete');
    }

    // Push the update branch first
    await execWithOutput(
      `git push -u origin ${updateBranch} --force`,
      repoDir,
      'Pushing update branch to remote (force)'
    );

    // Create pull request with correct versions
    log('🔄 Creating pull request...');
    await createPullRequest(
      repoName,
      repoDir,
      updateBranch,
      fromVersion,
      toVersion
    );

    log(`✅ Update completed successfully for ${repoName}`);
  } catch (error) {
    throw new Error(`Failed to update ${repoName}: ${getErrorMessage(error)}`);
  }
}

async function updateAllRepositories(): Promise<void> {
  const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const repoNames = Object.keys(config.repositories);

  log('Starting concurrent updates for all repositories...');

  const updatePromises = repoNames.map((repoName) =>
    updateRepository(repoName).catch((error) => {
      log(`ERROR updating ${repoName}: ${getErrorMessage(error)}`);
      throw error;
    })
  );

  await Promise.all(updatePromises);
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

      await updateRepository(repoName);
    }
  } catch (error) {
    log(`ERROR: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
