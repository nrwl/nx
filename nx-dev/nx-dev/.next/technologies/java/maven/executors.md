
  The @nx/maven plugin provides various executors to help you create and configure maven projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `maven`
The Maven executor is used to run Maven phases and goals.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `__unparsed__` | array | Additional arguments to pass to the Maven command (automatically populated by Nx). |  |
| `args` | string | The arguments to pass to the Maven command. |  |
| `goals` | string | The Maven goals to execute (e.g., 'clean:clean', 'compiler:compile'). |  |
| `phase` | string | The Maven lifecycle phase to execute (e.g., 'compile', 'test', 'package', 'install'). |  |
