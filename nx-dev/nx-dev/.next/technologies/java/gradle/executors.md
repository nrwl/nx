
  The @nx/gradle plugin provides various executors to help you create and configure gradle projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `gradle`
The Gradle Impl executor is used to run Gradle tasks.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `taskName` | string [**required**] | The name of the Gradle task to run. |  |
| `__unparsed__` | array | Additional arguments to pass to the gradle command (automatically populated by Nx). |  |
| `args` | string | The arguments to pass to the Gradle task. |  |
| `excludeDependsOn` | boolean | If true, the tasks will not execute its dependsOn tasks (e.g. pass --exclude-task args to gradle command). If false, the task will execute its dependsOn tasks. | `true` |
| `includeDependsOnTasks` | array | List of Gradle task paths that should be included (not excluded) even when excludeDependsOn is true. These are typically provider-based dependencies that Gradle must resolve. |  |
| `testClassName` | string | The full test name to run for test task (package name and class name). |  |
