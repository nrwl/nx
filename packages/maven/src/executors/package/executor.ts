import { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';

export interface PackageExecutorSchema {
  cwd?: string;
  goals?: string[];
  options?: string[];
  skipTests?: boolean;
}

export default async function runExecutor(
  options: PackageExecutorSchema,
  context: ExecutorContext
) {
  const projectRoot = context.projectsConfigurations?.projects?.[context.projectName!]?.root || '.';
  const cwd = options.cwd || projectRoot;
  const goals = options.goals || ['package'];
  const additionalOptions = options.options || [];

  // Add skip tests option if specified
  if (options.skipTests) {
    additionalOptions.push('-DskipTests');
  }

  const command = ['mvn', ...goals, ...additionalOptions].join(' ');

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
    console.error('Maven package failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}