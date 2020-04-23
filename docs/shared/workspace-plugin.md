# Workspace Plugin

The workspace plugin contains builders and schematics that are useful for any Nx workspace. It should be present in every Nx workspace and other plugins build on it.

## Schematics

- [library](/angular/plugins/workspace/schematics/library) - Create a plain typescript library
- [move](/angular/plugins/workspace/schematics/move) - Move a project to another directory and update all references
- [remove](/angular/plugins/workspace/schematics/remove) - Remove a project from the workspace
- [workspace-schematic](/angular/plugins/workspace/schematics/workspace-schematic) - Scaffold a custom schematic for use within your workspace

## Builders

- [run-commands](/angular/plugins/workspace/builders/run-commands) - Execute an arbitrary command line script
