# Workspace Plugin

The workspace plugin contains executors and generators that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Generators

- [library](/angular/plugins/workspace/generators/library) - Create a plain typescript library
- [move](/angular/plugins/workspace/generators/move) - Move a project to another directory and update all references
- [remove](/angular/plugins/workspace/generators/remove) - Remove a project from the workspace
- [workspace-generator](/angular/plugins/workspace/generators/workspace-schematic) - Scaffold a custom generator for use within your workspace

## Executors / Builders

- [run-commands](/angular/plugins/workspace/executors/run-commands) - Execute an arbitrary command line script
