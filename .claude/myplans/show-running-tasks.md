# Plan: `nx show running-tasks`

## Goal

CLI command for agents to live-query running task status without needing VSCode/Nx Console.

## Architecture

```
nx run-many -t build,serve            nx show running-tasks
        │                                      │
        │ LifeCycle hooks                      │ daemon client
        ▼                                      ▼
   ┌──────────────────── Nx Daemon ─────────────────────────┐
   │  In-memory: Map<pid, RunningProcessState>              │
   │                                                        │
   │  REGISTER_RUNNING_TASKS    → store initial state       │
   │  UPDATE_RUNNING_TASKS      → update task statuses      │
   │  UNREGISTER_RUNNING_TASKS  → remove on end             │
   │  GET_RUNNING_TASKS         → return all active runs    │
   │  GET_RUNNING_TASK_OUTPUT   → return task's log output  │
   └────────────────────────────────────────────────────────┘
```

Running `nx` process reports state to daemon via lifecycle hooks.
`nx show running-tasks` queries daemon. No files, no new sockets.
Reuses existing daemon IPC infrastructure.

## Data Structures

```typescript
// Stored in daemon memory per running process
interface RunningProcessState {
  pid: number;
  command: string;
  startTime: string; // ISO
  tasks: Record<string, RunningTaskState>;
}

interface RunningTaskState {
  status:
    | 'not-started'
    | 'in-progress'
    | 'success'
    | 'failure'
    | 'skipped'
    | 'local-cache'
    | 'remote-cache'
    | 'local-cache-kept-existing'
    | 'stopped';
  continuous: boolean;
  startTime?: string;
  endTime?: string;
}

// Output stored separately in ring buffer (last 100 lines per task)
```

## Implementation Steps

### ~~Step 1: Daemon message types~~ DONE

**Create** `packages/nx/src/daemon/message-types/running-tasks.ts`

5 message types following the existing pattern (type constant + interface + type guard):

- `REGISTER_RUNNING_TASKS` — pid, command, task list
- `UPDATE_RUNNING_TASKS` — pid, task status changes, output chunks
- `UNREGISTER_RUNNING_TASKS` — pid
- `GET_RUNNING_TASKS` — no payload, returns all active runs (no output)
- `GET_RUNNING_TASK_OUTPUT` — pid + taskId, returns buffered output

### ~~Step 2: Daemon server handler~~ DONE

**Create** `packages/nx/src/daemon/server/handle-running-tasks.ts`

- `runningProcesses: Map<number, RunningProcessState>` in module scope
- `outputBuffers: Map<string, string[]>` keyed by `${pid}:${taskId}`, ring buffer of last 100 lines
- `handleRegisterRunningTasks()` — store initial state
- `handleUpdateRunningTasks()` — update statuses + append output to ring buffer
- `handleUnregisterRunningTasks()` — delete from map
- `handleGetRunningTasks()` — prune dead PIDs (`process.kill(pid, 0)`), return remaining
- `handleGetRunningTaskOutput()` — return joined ring buffer for specific task

### ~~Step 3: Wire into daemon server~~ DONE

**Modify** `packages/nx/src/daemon/server/server.ts`

Add dispatch cases in `handleMessage()` for the 5 new message types, following the existing pattern with `handleResult()`.

### ~~Step 4: Daemon client methods~~ DONE

**Modify** `packages/nx/src/daemon/client/client.ts`

Add methods:

- `registerRunningTasks(pid, command, taskIds)`
- `updateRunningTasks(pid, updates, outputChunks)`
- `unregisterRunningTasks(pid)`
- `getRunningTasks()` — returns `RunningProcessState[]`
- `getRunningTaskOutput(pid, taskId)` — returns `string`

### ~~Step 5: DaemonReportingLifeCycle~~ DONE

**Create** `packages/nx/src/tasks-runner/life-cycles/daemon-reporting-life-cycle.ts`

Implements `LifeCycle`:

- `startCommand()` → `daemonClient.registerRunningTasks(process.pid, command, [])`
- `startTasks(tasks)` → `daemonClient.updateRunningTasks(pid, tasks.map(t => ({id: t.id, status: 'in-progress'})), {})`
- `setTaskStatus(taskId, status)` → `daemonClient.updateRunningTasks(pid, [{id: taskId, status}], {})`
- `endTasks(taskResults)` → `daemonClient.updateRunningTasks(pid, results, {})`
- `appendTaskOutput(taskId, output)` → batched/debounced (2s), then `daemonClient.updateRunningTasks(pid, [], {taskId: output})`
- `endCommand()` → `daemonClient.unregisterRunningTasks(process.pid)`
- All calls are fire-and-forget (catch errors silently). Lifecycle must never block task execution.
- If daemon is unavailable, all methods no-op.

### ~~Step 6: Wire lifecycle into run-command.ts~~ DONE

**Modify** `packages/nx/src/tasks-runner/run-command.ts`

Add `DaemonReportingLifeCycle` to the `lifeCycles` array in `getTerminalOutputLifeCycle()`, guarded by `daemonClient.enabled()`. Applies in both TUI and non-TUI code paths.

### ~~Step 7: CLI command~~ DONE

**Create** `packages/nx/src/command-line/show/running-tasks.ts`

Handler for `nx show running-tasks`:

- Connects to daemon via `daemonClient.getRunningTasks()`
- Default: outputs JSON array of all active runs with task statuses
- `--task <taskId>` flag: calls `daemonClient.getRunningTaskOutput(pid, taskId)`, returns log output

**Modify** `packages/nx/src/command-line/show/command-object.ts`

Add `running-tasks` subcommand to the `show` command builder.

Types to add:

```typescript
export type ShowRunningTasksOptions = NxShowArgs & {
  task?: string;
  verbose?: boolean;
};
```

## Output Format

### `nx show running-tasks` (default, JSON)

```json
[
  {
    "pid": 12345,
    "command": "nx run-many -t build,serve",
    "startTime": "2026-02-24T10:00:00.000Z",
    "tasks": {
      "myapp:build": {
        "status": "success",
        "continuous": false,
        "startTime": "2026-02-24T10:00:01.000Z",
        "endTime": "2026-02-24T10:00:05.000Z"
      },
      "myapp:serve": {
        "status": "in-progress",
        "continuous": true,
        "startTime": "2026-02-24T10:00:05.000Z"
      }
    }
  }
]
```

### `nx show running-tasks --task myapp:serve`

Returns raw log output (last 100 lines) as plain text.

## Files to Create/Modify

| File                                                                      | Action                      |
| ------------------------------------------------------------------------- | --------------------------- |
| `packages/nx/src/daemon/message-types/running-tasks.ts`                   | Create                      |
| `packages/nx/src/daemon/server/handle-running-tasks.ts`                   | Create                      |
| `packages/nx/src/daemon/server/server.ts`                                 | Modify — add dispatch       |
| `packages/nx/src/daemon/client/client.ts`                                 | Modify — add client methods |
| `packages/nx/src/tasks-runner/life-cycles/daemon-reporting-life-cycle.ts` | Create                      |
| `packages/nx/src/tasks-runner/run-command.ts`                             | Modify — add lifecycle      |
| `packages/nx/src/command-line/show/running-tasks.ts`                      | Create                      |
| `packages/nx/src/command-line/show/command-object.ts`                     | Modify — add subcommand     |

## ~~Test Cases~~ ALL DONE (23 tests passing)

### Test 1: DaemonReportingLifeCycle (unit)

**File**: `packages/nx/src/tasks-runner/life-cycles/daemon-reporting-life-cycle.spec.ts`

Mock `daemonClient`. Follow the `StoreRunInformationLifeCycle` test pattern: call lifecycle methods in sequence, assert the daemon client was called with correct args.

```typescript
describe('DaemonReportingLifeCycle', () => {
  let mockDaemonClient;
  let lifecycle;

  beforeEach(() => {
    mockDaemonClient = {
      enabled: jest.fn().mockReturnValue(true),
      registerRunningTasks: jest.fn().mockResolvedValue(undefined),
      updateRunningTasks: jest.fn().mockResolvedValue(undefined),
      unregisterRunningTasks: jest.fn().mockResolvedValue(undefined),
    };
    lifecycle = new DaemonReportingLifeCycle(
      mockDaemonClient,
      'nx run-many -t build'
    );
  });

  it('should register on startCommand and unregister on endCommand', async () => {
    await lifecycle.startCommand();
    expect(mockDaemonClient.registerRunningTasks).toHaveBeenCalledWith(
      process.pid,
      'nx run-many -t build',
      []
    );

    await lifecycle.endCommand();
    expect(mockDaemonClient.unregisterRunningTasks).toHaveBeenCalledWith(
      process.pid
    );
  });

  it('should send task status updates through lifecycle', async () => {
    const tasks = [{ id: 'app:build' }, { id: 'lib:build' }] as Task[];

    await lifecycle.startCommand();
    await lifecycle.startTasks(tasks, {} as TaskMetadata);

    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      expect.arrayContaining([
        expect.objectContaining({ id: 'app:build', status: 'in-progress' }),
        expect.objectContaining({ id: 'lib:build', status: 'in-progress' }),
      ]),
      {}
    );
  });

  it('should send final statuses on endTasks', async () => {
    await lifecycle.startCommand();
    await lifecycle.endTasks(
      [
        { task: { id: 'app:build' }, status: 'success', code: 0 },
        { task: { id: 'lib:build' }, status: 'failure', code: 1 },
      ] as TaskResult[],
      {} as TaskMetadata
    );

    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      expect.arrayContaining([
        expect.objectContaining({ id: 'app:build', status: 'success' }),
        expect.objectContaining({ id: 'lib:build', status: 'failure' }),
      ]),
      {}
    );
  });

  it('should no-op when daemon is disabled', async () => {
    mockDaemonClient.enabled.mockReturnValue(false);
    lifecycle = new DaemonReportingLifeCycle(mockDaemonClient, 'nx build app');

    await lifecycle.startCommand();
    await lifecycle.startTasks(
      [{ id: 'app:build' }] as Task[],
      {} as TaskMetadata
    );
    await lifecycle.endCommand();

    expect(mockDaemonClient.registerRunningTasks).not.toHaveBeenCalled();
    expect(mockDaemonClient.updateRunningTasks).not.toHaveBeenCalled();
    expect(mockDaemonClient.unregisterRunningTasks).not.toHaveBeenCalled();
  });

  it('should silently catch daemon errors without blocking', async () => {
    mockDaemonClient.registerRunningTasks.mockRejectedValue(
      new Error('daemon down')
    );

    // Should not throw
    await lifecycle.startCommand();
    await lifecycle.startTasks(
      [{ id: 'app:build' }] as Task[],
      {} as TaskMetadata
    );
  });

  it('should batch appendTaskOutput with 2s debounce', async () => {
    jest.useFakeTimers();
    await lifecycle.startCommand();

    lifecycle.appendTaskOutput('app:build', 'line 1\n', true);
    lifecycle.appendTaskOutput('app:build', 'line 2\n', true);

    // Not sent yet (debounced)
    expect(mockDaemonClient.updateRunningTasks).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ 'app:build': expect.any(String) })
    );

    jest.advanceTimersByTime(2000);

    // Now sent as single batched call
    expect(mockDaemonClient.updateRunningTasks).toHaveBeenCalledWith(
      process.pid,
      [],
      { 'app:build': 'line 1\nline 2\n' }
    );

    jest.useRealTimers();
  });
});
```

### Test 2: Daemon handler (unit)

**File**: `packages/nx/src/daemon/server/handle-running-tasks.spec.ts`

Tests the in-memory state management in the server handler.

```typescript
describe('handle-running-tasks', () => {
  beforeEach(() => {
    // Reset module-level state between tests
    clearRunningProcesses();
  });

  it('should register and retrieve running tasks', async () => {
    await handleRegisterRunningTasks(1234, 'nx run-many -t build', [
      'app:build',
      'lib:build',
    ]);

    const result = await handleGetRunningTasks();
    expect(result.response).toEqual([
      expect.objectContaining({
        pid: 1234,
        command: 'nx run-many -t build',
        tasks: expect.objectContaining({
          'app:build': expect.objectContaining({ status: 'not-started' }),
          'lib:build': expect.objectContaining({ status: 'not-started' }),
        }),
      }),
    ]);
  });

  it('should update task statuses', async () => {
    await handleRegisterRunningTasks(1234, 'nx build app', ['app:build']);
    await handleUpdateRunningTasks(
      1234,
      [{ id: 'app:build', status: 'in-progress' }],
      {}
    );

    const result = await handleGetRunningTasks();
    expect(result.response[0].tasks['app:build'].status).toBe('in-progress');
  });

  it('should store and retrieve task output (ring buffer, last 100 lines)', async () => {
    await handleRegisterRunningTasks(1234, 'nx serve app', ['app:serve']);

    // Send 150 lines of output
    const lines = Array.from({ length: 150 }, (_, i) => `line ${i}\n`).join('');
    await handleUpdateRunningTasks(1234, [], { 'app:serve': lines });

    const result = await handleGetRunningTaskOutput(1234, 'app:serve');
    const outputLines = result.response.split('\n').filter(Boolean);
    expect(outputLines.length).toBe(100);
    expect(outputLines[0]).toBe('line 50');
    expect(outputLines[99]).toBe('line 149');
  });

  it('should unregister and clean up', async () => {
    await handleRegisterRunningTasks(1234, 'nx build', ['app:build']);
    await handleUnregisterRunningTasks(1234);

    const result = await handleGetRunningTasks();
    expect(result.response).toEqual([]);
  });

  it('should prune processes with dead PIDs on GET', async () => {
    // Register with a PID that doesn't exist
    await handleRegisterRunningTasks(999999, 'nx build', ['app:build']);

    const result = await handleGetRunningTasks();
    expect(result.response).toEqual([]);
  });

  it('should handle multiple concurrent runs', async () => {
    await handleRegisterRunningTasks(1111, 'nx build app', ['app:build']);
    await handleRegisterRunningTasks(2222, 'nx serve app', ['app:serve']);

    const result = await handleGetRunningTasks();
    expect(result.response).toHaveLength(2);
  });
});
```

### Test 3: CLI command handler (unit)

**File**: `packages/nx/src/command-line/show/running-tasks.spec.ts`

```typescript
describe('showRunningTasksHandler', () => {
  let mockDaemonClient;

  beforeEach(() => {
    mockDaemonClient = {
      getRunningTasks: jest.fn(),
      getRunningTaskOutput: jest.fn(),
    };
  });

  it('should output JSON of all running tasks', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation();
    mockDaemonClient.getRunningTasks.mockResolvedValue([
      {
        pid: 1234,
        command: 'nx serve app',
        startTime: '2026-02-24T10:00:00.000Z',
        tasks: {
          'app:serve': { status: 'in-progress', continuous: true },
        },
      },
    ]);

    await showRunningTasksHandler({ json: true }, mockDaemonClient);

    expect(spy).toHaveBeenCalled();
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].tasks['app:serve'].status).toBe('in-progress');
    spy.mockRestore();
  });

  it('should output task log when --task is provided', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation();
    mockDaemonClient.getRunningTasks.mockResolvedValue([
      {
        pid: 1234,
        command: 'nx serve',
        tasks: { 'app:serve': { status: 'in-progress' } },
      },
    ]);
    mockDaemonClient.getRunningTaskOutput.mockResolvedValue(
      'Server running on http://localhost:4200\n'
    );

    await showRunningTasksHandler({ task: 'app:serve' }, mockDaemonClient);

    expect(mockDaemonClient.getRunningTaskOutput).toHaveBeenCalledWith(
      1234,
      'app:serve'
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('localhost:4200'));
    spy.mockRestore();
  });

  it('should return empty array when no tasks running', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation();
    mockDaemonClient.getRunningTasks.mockResolvedValue([]);

    await showRunningTasksHandler({ json: true }, mockDaemonClient);

    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toEqual([]);
    spy.mockRestore();
  });
});
```

### Test 4: Message type guards (unit)

**File**: Test inline within `packages/nx/src/daemon/message-types/running-tasks.ts` or separate spec.

Verify type guard functions correctly identify message types. Follow pattern from existing message types.

```typescript
describe('running-tasks message types', () => {
  it('should identify REGISTER_RUNNING_TASKS messages', () => {
    expect(
      isRegisterRunningTasksMessage({
        type: REGISTER_RUNNING_TASKS,
        pid: 1,
        command: '',
        taskIds: [],
      })
    ).toBe(true);
    expect(isRegisterRunningTasksMessage({ type: 'OTHER' })).toBe(false);
  });

  // Similar for UPDATE, UNREGISTER, GET_RUNNING_TASKS, GET_RUNNING_TASK_OUTPUT
});
```

## Edge Cases to Handle

- Daemon disabled (`NX_DAEMON=false`, CI) → lifecycle silently no-ops
- Daemon crashes mid-run → lifecycle catches errors, task execution unaffected
- Process killed without cleanup → `GET_RUNNING_TASKS` prunes dead PIDs
- Multiple `nx run` processes simultaneously → each registers with its own PID
- `nx show running-tasks` when no tasks running → returns `[]`
- `--task` flag with non-existent task → clear error message
- `--task` flag matches task in multiple running processes → return output from the one that has it
