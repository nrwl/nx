
  The @nx/vitest plugin provides various executors to help you create and configure vitest projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `test`
Test using Vitest.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `configFile` | string | The path to the local vitest config, relative to the workspace root. |  |
| `mode` | string | Vite mode for loading configuration. |  |
| `reportsDirectory` | string | Directory to write coverage report to. |  |
| `runMode` | string | Vitest execution mode. | `"test"` |
| `testFiles` | array |  |  |
| `watch` | boolean | Watch files for changes and rerun tests related to changed files. |  |
