# Workspace Plugin

The workspace plugin contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Generators

- [library](/workspace/library) - Create a plain typescript library
- [move](/workspace/move) - Move a project to another directory and update all references
- [remove](/workspace/remove) - Remove a project from the workspace
- [run-commands](/workspace/run-commands-executor) - Add a target to a project that uses the run-commands executor
- [workspace-generator](/workspace/workspace-generator) - Scaffold a custom generator for use within your workspace

## Executors / Builders

- [run-commands](/workspace/run-commands-executor) - Execute an arbitrary command line script
