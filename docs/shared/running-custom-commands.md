# Running Custom Commands

You can easily run any command with the Nx toolchain. The main benefit is to make the [operation cacheable](/concepts/how-caching-works), [distributable](/core-features/distribute-task-execution) as well as being able to use it [with Nx's affected commands](/concepts/affected).

## 1. Define the terminal command to be run

The command we want to run for each project is:

```shell
make hello
```

With this `Makefile` in the root of the project:

```shell
hello:
  echo "Hello, world!"
```

## 2. Update `project.json`

For each project for which you want to enable `make`, add a target in its `project.json`:

```jsonc {% fileName="project.json" %}
// ...
"targets": {
    "make": {
        "command": "make hello"
    }
    // ...
}
```

For more information (e.g. how to forward arguments), see the [run-commands api doc](/packages/nx/executors/run-commands).

## 3. Run the command

To run the command, use the usual Nx syntax:

```shell
nx run my-app:make
```

or

```shell
nx make my-app
```

You can also run the `make` command for all projects it has been defined on:

```shell
nx run-many -t make
```

Or just on a subset of projects that are [affected by a given change](/concepts/affected):

```shell
nx affected -t make
```
