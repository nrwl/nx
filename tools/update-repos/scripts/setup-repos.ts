#!/usr/bin/env ts-node

import { execSync, exec } from 'child_process';
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

const SCRIPT_DIR = __dirname;
const REPOS_DIR = path.join(os.tmpdir(), 'updating-nx', 'repos');
const CONFIG_FILE = path.join(SCRIPT_DIR, '..', 'config', 'repos.json');

function log(message: string) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`${timestamp} [SETUP] ${message}`);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function setupClone(
  repoName: string,
  repoIdentifier: string,
  repoBranch: string
): Promise<void> {
  const cloneDir = path.join(REPOS_DIR, repoName);

  log(`Setting up clone for ${repoName}...`);

  // Remove existing clone if it exists
  if (fs.existsSync(cloneDir)) {
    log(`Removing existing clone for ${repoName}...`);
    execSync(`rm -rf "${cloneDir}"`);
  }

  try {
    // Clone repository using gh cli
    log(`Cloning ${repoName} from ${repoIdentifier}...`);
    await execAsync(`gh repo clone "${repoIdentifier}" "${cloneDir}"`);

    // Checkout the specified branch
    log(`Checking out branch: ${repoBranch}`);
    await execAsync(`cd "${cloneDir}" && git checkout "${repoBranch}"`);

    log(`Clone for ${repoName} created at ${cloneDir}`);
  } catch (error) {
    throw new Error(
      `Failed to setup clone for ${repoName}: ${getErrorMessage(error)}`
    );
  }
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

async function main(): Promise<void> {
  log('Starting repository cloning...');

  try {
    // Check if gh cli is available
    await checkRequiredTools();

    // Check if config file exists
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error(`Configuration file not found at ${CONFIG_FILE}`);
    }

    // Create repos directory if it doesn't exist
    if (!fs.existsSync(REPOS_DIR)) {
      log(`Creating repos directory: ${REPOS_DIR}`);
      fs.mkdirSync(REPOS_DIR, { recursive: true });
    }

    // Read configuration
    const config: Config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

    // Process repositories concurrently
    const clonePromises = Object.entries(config.repositories).map(
      ([repoName, repoConfig]) =>
        setupClone(repoName, repoConfig.repo, repoConfig.branch)
    );

    await Promise.all(clonePromises);

    log('Repository cloning completed successfully!');
    log(`Repositories are available in: ${REPOS_DIR}`);
  } catch (error) {
    log(`ERROR: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
