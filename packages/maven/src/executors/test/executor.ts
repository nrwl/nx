import { ExecutorContext } from '@nx/devkit';
import { execSync } from 'child_process';

export interface TestExecutorSchema {
  cwd?: string;
  goals?: string[];
  options?: string[];
  testNamePattern?: string;
}

export default async function runExecutor(
  options: TestExecutorSchema,
  context: ExecutorContext
) {
  const projectRoot = context.projectsConfigurations?.projects?.[context.projectName!]?.root || '.';
  const cwd = options.cwd || projectRoot;
  const goals = options.goals || ['test'];
  const additionalOptions = options.options || [];

  // Add test name pattern if specified
  if (options.testNamePattern) {
    additionalOptions.push(`-Dtest=${options.testNamePattern}`);
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
    console.error('Maven test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}