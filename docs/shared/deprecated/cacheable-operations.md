# cacheableOperations

In Nx < 17, the way to define which tasks were cacheable was to add the task name to the `cacheableOperations` array in `nx.json`. This way of defining cacheable tasks required all tasks named `test` to be either cacheable or not cacheable.

In Nx 17, use the `cache` property in `targetDefaults` or individual target definitions in the project level configuration.
