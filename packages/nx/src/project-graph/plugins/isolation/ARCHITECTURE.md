# Plugin Isolation Architecture

## 1. Plugin Loading Flow

### 1a. Entry Point - Isolation Decision

```mermaid
flowchart TD
    Start([getPlugins called]) --> CheckIsolation{Isolation<br/>enabled?}
    CheckIsolation -->|Yes| LoadIsolated[loadIsolatedNxPlugin]
    CheckIsolation -->|No| LoadInProcess[loadNxPluginInProcess]
    LoadIsolated --> IsolatedPath([See: Isolated Loading])
    LoadInProcess --> InProcessPath([See: In-Process Loading])
```

### 1b. Isolated Plugin Loading

```mermaid
flowchart TD
    subgraph Main["Main Process"]
        Start([loadIsolatedNxPlugin]) --> CheckCache{In cache?}
        CheckCache -->|Yes| ReturnCached([Return cached promise])
        CheckCache -->|No| StaticLoad[IsolatedPlugin.load]
        StaticLoad --> Resolve[resolveNxPlugin<br/>find plugin path]
        Resolve --> SpawnWorker[spawn child process]
    end

    SpawnWorker -.->|"start process"| WorkerStart

    subgraph Worker["Worker Process (plugin-worker.ts)"]
        WorkerStart([process starts]) --> CreateServer[create Unix socket server]
        CreateServer --> Listen[listen for connections]
        Listen --> WaitForConnect[wait for main process]
        WaitForConnect --> HandleLoad[receive 'load' message]

        subgraph InProcess["In-Process Loading (same as 1c)"]
            HandleLoad --> RequirePlugin[require plugin module]
            RequirePlugin --> NormalizePlugin[normalizeNxPlugin]
        end

        NormalizePlugin --> SendLoadResult[send 'loadResult'<br/>with hook capabilities]
        SendLoadResult --> WaitForMessages[wait for hook messages<br/>or socket close]
        WaitForMessages --> HandleHook{message<br/>received?}
        HandleHook -->|hook message| ExecuteHook[call plugin.hook]
        ExecuteHook --> SendResult[send result]
        SendResult --> WaitForMessages
        HandleHook -->|socket closed| Cleanup[cleanup & exit]
    end

    subgraph Main2["Main Process (continued)"]
        ConnectSocket[connect via<br/>Unix socket] --> SendLoad[send 'load' message]
        SendLoad --> WaitLoad[wait for 'loadResult']
        WaitLoad --> SetupHooks[setupHooks<br/>create lifecycle manager]
        SetupHooks --> CheckGraphHooks{Has graph<br/>phase hooks?}
        CheckGraphHooks -->|No| EarlyShutdown[socket.end<br/>shutdown worker]
        CheckGraphHooks -->|Yes| KeepAlive[keep worker alive]
        EarlyShutdown --> Done([Plugin ready])
        KeepAlive --> Done
    end

    SpawnWorker --> ConnectSocket
    SendLoadResult -.->|"loadResult"| WaitLoad
    EarlyShutdown -.->|"socket close"| Cleanup
```

### 1c. In-Process Plugin Loading

```mermaid
flowchart TD
    Start([loadNxPluginInProcess]) --> Resolve[resolveNxPlugin]
    Resolve --> Require[require plugin module]
    Require --> Normalize[normalizeNxPlugin<br/>wrap hooks]
    Normalize --> Done([Plugin ready])
```

## 2. Hook Execution Flow

### 2a. Isolated Hook Execution

```mermaid
flowchart TD
    Start([hook called<br/>e.g. createNodes]) --> EnsureAlive{_alive?}
    EnsureAlive -->|No| Restart[spawnAndConnect<br/>restart worker]
    Restart --> SetAlive[_alive = true]
    SetAlive --> EnsureAlive

    EnsureAlive -->|Yes| EnterHook[lifecycle.enterHook<br/>increment session count]
    EnterHook --> SendRequest[sendRequest<br/>over socket]
    SendRequest --> WaitResponse[wait for response<br/>with timeout]

    WaitResponse --> CheckSuccess{success?}
    CheckSuccess -->|No| ExitHookError[lifecycle.exitHook]
    ExitHookError --> ThrowError[throw error]

    CheckSuccess -->|Yes| ExitHook[lifecycle.exitHook]
    ExitHook --> CheckShutdown{should<br/>shutdown?}
    CheckShutdown -->|Yes| Shutdown[shutdown worker]
    CheckShutdown -->|No| Return([return result])
    Shutdown --> Return
```

### 2b. Shutdown Decision Logic

```mermaid
flowchart TD
    Start([exitHook called]) --> IsLastHook{Last hook<br/>in phase?}
    IsLastHook -->|No| NoShutdown1([return false])

    IsLastHook -->|Yes| CheckSessions{sessionCount<br/>== 0?}
    CheckSessions -->|No| NoShutdown2([return false<br/>other callers active])

    CheckSessions -->|Yes| CheckLaterPhases{Has later<br/>active phases?}
    CheckLaterPhases -->|Yes| NoShutdown3([return false<br/>needed later])
    CheckLaterPhases -->|No| YesShutdown([return true<br/>safe to shutdown])
```

## 3. Developer Workflow: Adding/Modifying Plugin Hooks

### Step 1: Design Public API

```mermaid
flowchart TD
    A1[public-api.ts] --> A2[Define context type<br/>e.g. MyHookContext]
    A2 --> A3[Export new types]
    A3 --> A4[loaded-nx-plugin.ts]
    A4 --> A5[Add hook to<br/>LoadedNxPlugin interface]
```

### Step 2: Define Message Types

```mermaid
flowchart TD
    B1[messaging.ts] --> B2[Add entry to PluginMessageDefs]
    B2 --> B3[Define payload and result types]
    B3 --> B4[Add to MESSAGE_TYPES array]
    B4 --> B5[Add to RESULT_TYPES array]
```

The messaging system uses a unified `DefineMessages` pattern. To add a new message:

```typescript
// In PluginMessageDefs, add a new entry:
type PluginMessageDefs = DefineMessages<{
  // ... existing messages ...

  myHook: {
    payload: {
      context: MyHookContext;
    };
    result:
      | { success: true; data: MyResultData }
      | { success: false; error: Error };
  };
}>;
```

The individual message/result types (`PluginWorkerMyHookMessage`, `PluginWorkerMyHookResult`)
are automatically derived. Export them if needed for external use:

```typescript
export type PluginWorkerMyHookMessage = MessageOf<PluginMessageDefs, 'myHook'>;
export type PluginWorkerMyHookResult = ResultOf<PluginMessageDefs, 'myHook'>;
```

### Step 3: Handle in Worker Process

```mermaid
flowchart TD
    C1[plugin-worker.ts] --> C2[Add handler in<br/>consumeMessage]
    C2 --> C3["Call plugin.myHook()"]
    C3 --> C4[Return result payload]
```

Handlers return just the result payload - the infrastructure wraps it automatically:

```typescript
// In consumeMessage handlers:
myHook: async ({ context }) => {
  try {
    const data = await plugin.myHook(context);
    return { success: true as const, data };
  } catch (e) {
    return { success: false as const, error: createSerializableError(e) };
  }
},
```

### Step 4: Update Load Result

```mermaid
flowchart TD
    D1[messaging.ts] --> D2[Add hasMyHook to<br/>load.result in PluginMessageDefs]
    D2 --> D3[plugin-worker.ts]
    D3 --> D4[Populate hasMyHook<br/>in load handler]
```

### Step 5: Wire Up IsolatedPlugin

```mermaid
flowchart TD
    E1[isolated-plugin.ts] --> E2[Add hook property<br/>to class]
    E2 --> E3[Update LoadResultPayload<br/>type export]
    E3 --> E4[Add to registeredHooks<br/>array in setupHooks]
    E4 --> E5[Add wrapped hook<br/>implementation]
    E5 --> E6["wrap('myHook', async (ctx) => {<br/>  sendRequest('myHook', { context: ctx })<br/>})"]
```

### Step 6: Update Lifecycle Phases (if needed)

```mermaid
flowchart TD
    F1{New phase<br/>needed?} -->|Yes| F2[plugin-lifecycle-manager.ts]
    F2 --> F3[Add phase to<br/>HOOKS_BY_PHASE]
    F1 -->|No| F4[Add hook to existing<br/>phase array in HOOKS_BY_PHASE]
```

### Step 7: Add Tests

```mermaid
flowchart TD
    G1[isolated-plugin.spec.ts] --> G2[Test hook registration]
    G2 --> G3[Test hook execution]
    G3 --> G4[Test restart behavior]
    G4 --> G5[plugin-lifecycle-manager.spec.ts]
    G5 --> G6[Test phase transitions<br/>with new hook]
    G6 --> G7[Test shutdown decisions]
```

## File Reference

| File                          | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `../public-api.ts`            | Public types exported to plugin authors                       |
| `../loaded-nx-plugin.ts`      | Interface definition for loaded plugins                       |
| `messaging.ts`                | Message type definitions for worker communication             |
| `plugin-worker.ts`            | Worker process - receives messages, calls plugin functions    |
| `isolated-plugin.ts`          | Main class - spawns worker, sends messages, manages lifecycle |
| `plugin-lifecycle-manager.ts` | Tracks phases, decides when to shutdown                       |
| `load-isolated-plugin.ts`     | Caching layer for isolated plugins                            |
| `../get-plugins.ts`           | Entry point - decides isolation mode                          |

## Lifecycle Phases

```
LOADED → [graph] → [pre-task] → {tasks run} → [post-task]
           │           │                           │
           │           └── preTasksExecution ──────┤
           │                                       │
           ├── createNodes                         │
           ├── createDependencies                  │
           └── createMetadata                      │
                                                   │
                                    postTasksExecution
```

**Shutdown rules:**

- Plugin shuts down after its last active phase completes
- If only `postTasksExecution`: shutdown immediately after load, restart when needed
- Concurrent callers tracked via session count (ref counting)
