import { ExecutorContext, workspaceRoot } from '@nx/devkit';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Detect Maven wrapper in workspace root, fallback to 'mvn'
 */
function detectMavenWrapper(): string {
  const isWindows = process.platform === 'win32';
  const wrapperFile = isWindows ? 'mvnw.cmd' : 'mvnw';
  const wrapperPath = join(workspaceRoot, wrapperFile);

  if (existsSync(wrapperPath)) {
    return wrapperPath;
  }

  return 'mvn';
}

export interface CompileExecutorSchema {
  cwd?: string;
  goals?: string[];
  options?: string[];
}

export default async function runExecutor(
  options: CompileExecutorSchema,
  context: ExecutorContext
) {
  const projectRoot = context.projectsConfigurations?.projects?.[context.projectName!]?.root || '.';
  const cwd = options.cwd || projectRoot;
  const goals = options.goals || ['compile'];
  const additionalOptions = options.options || [];

  const mavenExecutable = detectMavenWrapper();
  const command = [mavenExecutable, ...goals, ...additionalOptions].join(' ');

  try {
    console.log(`Executing: ${command}`);
    console.log(`Working directory: ${cwd}`);
    
    execSync(command, {
      cwd,
      stdio: 'inherit',
      shell: true
    } as any);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Maven compile failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}