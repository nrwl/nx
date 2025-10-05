# Function: createProjectGraphAsync

▸ **createProjectGraphAsync**(`opts?`): `Promise`\<[`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)\>

Computes and returns a ProjectGraph.

Nx will compute the graph either in a daemon process or in the current process.

Nx will compute it in the current process if:

- The process is running in CI (CI env variable is to true or other common variables used by CI providers are set).
- It is running in the docker container.
- The daemon process is disabled because of the previous error when starting the daemon.
- `NX_DAEMON` is set to `false`.
- `useDaemonProcess` is set to false in the options of the tasks runner inside `nx.json`

`NX_DAEMON` env variable takes precedence:

- If it is set to true, the daemon will always be used.
- If it is set to false, the graph will always be computed in the current process.

Tip: If you want to debug project graph creation, run your command with NX_DAEMON=false.

Nx uses two layers of caching: the information about explicit dependencies stored on the disk and the information
stored in the daemon process. To reset both run: `nx reset`.

#### Parameters

| Name                      | Type      |
| :------------------------ | :-------- |
| `opts?`                   | `Object`  |
| `opts.exitOnError`        | `boolean` |
| `opts.resetDaemonClient?` | `boolean` |

#### Returns

`Promise`\<[`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)\>
