import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { MavenExecutorSchema } from './schema';

export interface MavenExecutorResult {
  success: boolean;
  terminalOutput?: string;
}

/**
 * Detect Maven executable: mvnw > mvn
 */
function detectMavenExecutable(root: string): string {
  // Check for Maven wrapper
  if (process.platform === 'win32') {
    const wrapperPath = join(root, 'mvnw.cmd');
    if (existsSync(wrapperPath)) {
      return 'mvnw.cmd';
    }
  } else {
    const wrapperPath = join(root, 'mvnw');
    if (existsSync(wrapperPath)) {
      return './mvnw';
    }
  }
  // Fallback to Maven
  return 'mvn';
}

/**
 * Build Maven command arguments
 */
function buildMavenArgs(options: MavenExecutorSchema): string[] {
  const args: string[] = [];

  if (options.phase) {
    args.push(options.phase);
  }

  if (options.goals) {
    const goals = Array.isArray(options.goals)
      ? options.goals
      : options.goals.split(' ');
    args.push(...goals);
  }

  if (options.args) {
    const additionalArgs = Array.isArray(options.args)
      ? options.args
      : options.args.trim().split(' ');
    args.push(...additionalArgs.filter((arg) => arg.length > 0));
  }

  if (options.__unparsed__) {
    args.push(...options.__unparsed__);
  }

  return args;
}

/**
 * Execute Maven command in a child process
 */
async function executeMaven(
  executable: string,
  args: string[],
  cwd: string
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(executable, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        process.stdout.write(text);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      stderr += error.message;
      process.stderr.write(`Error: ${error.message}`);
      resolve({
        success: false,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Maven single-task executor
 */
export default async function mavenExecutor(
  options: MavenExecutorSchema,
  context: ExecutorContext
): Promise<MavenExecutorResult> {
  const projectRoot =
    context.projectGraph.nodes[context.projectName]?.data?.root ?? context.root;
  const mavenExecutable = detectMavenExecutable(workspaceRoot);
  const args = buildMavenArgs(options);

  try {
    const result = await executeMaven(mavenExecutable, args, projectRoot);

    return {
      success: result.success,
      terminalOutput: result.stdout + result.stderr,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      terminalOutput: errorMessage,
    };
  }
}
