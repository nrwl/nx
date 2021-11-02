# Workspace Plugin

The workspace plugin contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Generators

- [library](/{{framework}}/workspace/library) - Create a plain typescript library
- [move](/{{framework}}/workspace/move) - Move a project to another directory and update all references
- [remove](/{{framework}}/workspace/remove) - Remove a project from the workspace
- [run-commands](/{{framework}}/workspace/run-commands-executor) - Add a target to a project that uses the run-commands executor
- [workspace-generator](/{{framework}}/workspace/workspace-generator) - Scaffold a custom generator for use within your workspace

## Executors / Builders

- [run-commands](/{{framework}}/workspace/run-commands-executor) - Execute an arbitrary command line script
