# Workspace Plugin

The workspace plugin contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Creating Workspace Generators

Codifying your organization's best practices into workspace generators is a great way to ensure that the best practices are easy to follow and implement. Running `nx g @nrwl/workspace:workspace-generator feature` will create a workspace generator which is written the same way generators are written for Nx plugins. The workspace generator can then be run with `nx workspace-generator feature`.

> See more about [workspace generators](/generators/workspace-generators)

## Reorganizing Projects

After some time of working within a workspace, projects might need to be moved or sometimes even removed.
The workspace plugin provides the [`@nrwl/workspace:move`](/workspace/move) and [`@nrwl/workspace:remove`](/workspace/remove) generators to help aid with this.

### Moving Projects

Running `nx g @nrwl/workspace:move new/location/my-lib --projectName my-lib` will move the `my-lib` library to `libs/new/location/my-lib`.

Moving the files manually can be done easily but a lot of steps are often missed when projects are moved. This generator will also handle the following:

1. The project's files will be moved
2. The project will be renamed to `new-location-my-lib`
3. The path mapping in `tsconfig.base.json` will be changed to `@npmScope/new/location/my-lib`
4. Imports in other projects will be changed to `@npmScope/new/location/my-lib`
5. Paths in target options such as output path will be changed
6. Other configuration will be updated too such as `extends` in `tsconfig.json`, the name of the project in `jest.config.js`, and the extends in `.eslintrc.json`

> See more about [`@nrwl/workspace:move`](/workspace/move)

### Removing Projects

Running `nx g @nrwl/workspace:remove my-lib` will remove the `my-lib` from the workspace. It is important to note that sometimes, projects cannot be removed if they are still depended on by other projects.

Like when moving projects, some steps are often missed when removing projects. This generator will also handle the following:

1. Checks if other projects depend on the project being removed. This can be ignored via the `--forceRemove` flag.
2. The project's files will be deleted.
3. The project's configuration will be removed.
4. The path mapping in `tsconfig.base.json` will be removed.

> See more about [`@nrwl/workspace:remove`](/workspace/remove)

## Running custom commands

Executors provide an optimized way of running targets but unfortunately, not every target has an executor written for it. The [`nx:run-commands`](/packages/nx/executors/run-commands) executor is an executor that runs any command or multiple commands in the shell. This can be useful when integrating with other tools which do not have an executor provided. There is also a generator to help configure this executor.

Running `nx g nx:run-commands printhello --project my-feature-lib --command 'echo hello'` will create a `my-feature-lib:printhello` target that executes `echo hello` in the shell.

> See more about [`nx:run-commands`](/packages/nx/executors/run-commands)
