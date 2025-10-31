# Using argv in Task Execution Hooks

## Overview

Task execution hooks (`preTasksExecution` and `postTasksExecution`) provide access to the original CLI arguments via the `context.argv` property. This allows plugins to distinguish between different execution modes and make intelligent decisions based on how tasks were invoked.

## Context Interfaces

### PreTasksExecutionContext

```typescript
type PreTasksExecutionContext = {
  readonly id: string;
  readonly workspaceRoot: string;
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly argv: string[];  // Original CLI arguments
};
```

### PostTasksExecutionContext

```typescript
type PostTasksExecutionContext = {
  readonly id: string;
  readonly workspaceRoot: string;
  readonly nxJsonConfiguration: NxJsonConfiguration;
  readonly taskResults: TaskResults;
  readonly argv: string[];  // Original CLI arguments
  readonly startTime: number;
  readonly endTime: number;
};
```

## Example Usage

### Basic Example: Logging Command Type

```typescript
import type { NxPlugin, PostTasksExecutionContext } from '@nx/devkit';

export const myPlugin: NxPlugin = {
  name: 'my-plugin',
  
  postTasksExecution: async (options, context: PostTasksExecutionContext) => {
    console.log('Command invoked with:', context.argv.join(' '));
    
    if (context.argv.includes('affected')) {
      console.log('✅ Ran affected tasks');
    } else if (context.argv.includes('run-many')) {
      console.log('✅ Ran tasks for multiple projects');
    } else {
      console.log('✅ Ran task for specific project');
    }
  }
};
```

### Advanced Example: Conditional Behavior

```typescript
import type { NxPlugin, PreTasksExecutionContext, PostTasksExecutionContext } from '@nx/devkit';

function isAffectedCommand(argv: string[]): boolean {
  return argv.includes('affected');
}

function isWatchMode(argv: string[]): boolean {
  return argv.includes('--watch') || argv.includes('-w');
}

function getTargetName(argv: string[]): string | undefined {
  const targetIndex = argv.findIndex(arg => arg === '-t' || arg === '--target');
  return targetIndex !== -1 ? argv[targetIndex + 1] : undefined;
}

export const analyticsPlugin: NxPlugin = {
  name: 'analytics-plugin',
  
  preTasksExecution: async (options, context: PreTasksExecutionContext) => {
    const target = getTargetName(context.argv);
    const isAffected = isAffectedCommand(context.argv);
    
    // Skip certain validations for affected runs
    if (isAffected) {
      console.log('Running in affected mode - skipping expensive pre-checks');
      return;
    }
    
    // Run validations for direct builds
    console.log(`Running pre-build validations for ${target}`);
  },
  
  postTasksExecution: async (options, context: PostTasksExecutionContext) => {
    const isAffected = isAffectedCommand(context.argv);
    const isWatch = isWatchMode(context.argv);
    
    // Send analytics with context
    await sendAnalytics({
      executionId: context.id,
      commandType: isAffected ? 'affected' : 'direct',
      watchMode: isWatch,
      taskCount: Object.keys(context.taskResults).length,
      duration: context.endTime - context.startTime,
      failureCount: Object.values(context.taskResults).filter(
        result => result.status === 'failure'
      ).length,
    });
  }
};
```

### Example: Custom Notifications

```typescript
import type { NxPlugin, PostTasksExecutionContext } from '@nx/devkit';

export const notificationPlugin: NxPlugin = {
  name: 'notification-plugin',
  
  postTasksExecution: async (options, context: PostTasksExecutionContext) => {
    const hasFailed = Object.values(context.taskResults).some(
      result => result.status === 'failure'
    );
    
    // Only send notifications for CI or affected runs
    const isCI = process.env.CI === 'true';
    const isAffected = context.argv.includes('affected');
    
    if ((isCI || isAffected) && hasFailed) {
      await sendSlackNotification({
        message: `❌ Tasks failed in ${isAffected ? 'affected' : 'full'} run`,
        command: context.argv.join(' '),
        duration: `${(context.endTime - context.startTime) / 1000}s`,
      });
    }
  }
};
```

## Use Cases

1. **Distinguish Execution Modes**
   - Know whether tasks were triggered via `nx build my-app`, `nx affected -t build`, or `nx run-many`
   - Apply different logic based on the command type

2. **Conditional Validations**
   - Skip expensive checks for affected runs
   - Run additional validations for production builds
   - Enable/disable features based on flags

3. **Analytics and Monitoring**
   - Track which commands are most commonly used
   - Measure performance differences between execution modes
   - Identify patterns in command usage

4. **Smart Notifications**
   - Only notify on certain types of failures
   - Include command context in error reports
   - Filter notifications based on execution mode

5. **Debug Information**
   - Include the original command in logs
   - Help reproduce issues by knowing exact invocation
   - Provide better error messages with context

## Common Command Patterns

### Direct Target Execution
```bash
nx build my-app
# argv: ['node', '/path/to/nx', 'build', 'my-app']
```

### Affected Command
```bash
nx affected -t build test
# argv: ['node', '/path/to/nx', 'affected', '-t', 'build', 'test']
```

### Run Many
```bash
nx run-many -t build -p app1 app2
# argv: ['node', '/path/to/nx', 'run-many', '-t', 'build', '-p', 'app1', 'app2']
```

### With Additional Flags
```bash
nx build my-app --configuration=production --verbose
# argv: ['node', '/path/to/nx', 'build', 'my-app', '--configuration=production', '--verbose']
```

## Best Practices

1. **Parse argv Defensively**
   ```typescript
   // Bad - assumes structure
   const target = context.argv[2];
   
   // Good - searches for the flag
   const targetIndex = context.argv.findIndex(arg => arg === '-t' || arg === '--target');
   const target = targetIndex !== -1 ? context.argv[targetIndex + 1] : undefined;
   ```

2. **Use Helper Functions**
   ```typescript
   function hasFlag(argv: string[], flag: string): boolean {
     return argv.includes(flag) || argv.includes(`--${flag}`);
   }
   ```

3. **Consider Edge Cases**
   - Commands run via `nx.json` task pipelines
   - Commands run programmatically
   - Commands with complex flag combinations

4. **Document Behavior**
   - Clearly document how your plugin uses argv
   - Explain any special handling for different command types
   - Provide examples in your plugin's README

## Related

- Issue: https://linear.app/nxdev/issue/NXC-3382/add-contextargv-to-task-execution-hook-contexts
- Type Definitions: `packages/nx/src/project-graph/plugins/public-api.ts`
- Implementation: `packages/nx/src/tasks-runner/run-command.ts`
