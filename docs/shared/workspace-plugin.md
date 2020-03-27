# Workspace Plugin

The workspace plugin contains builders and schematics that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Schematics

- [library](/angular/plugins_workspace_schematics/library) - Create a plain typescript library
- [move](/angular/plugins_workspace_schematics/move) - Move a project to another directory and update all references
- [remove](/angular/plugins_workspace_schematics/remove) - Remove a project from the workspace
- [workspace-schematic](/angular/plugins_workspace_schematics/workspace-schematic) - Scaffold a custom schematic for use within your workspace

## Builders

- [run-commands](/angular/plugins_workspace_builders/run-commands) - Execute an arbitrary command line script
