# Using Schematics

## Types of Schematics

There are three main types of schematics:

1. **Plugin Schematics** are available when an Nx plugin has been installed in your workspace.
2. **Workspace Schematics** are schematics that you can create for your own workspace. [Workspace schematics](/{{framework}}/workspace_schematics/workspace-schematics) allow you to codify the processes that are unique to your own organization.
3. **Update Schematics** are invoked by Nx plugins when you [update Nx](/{{framework}}/workspace/update) to keep your config files in sync with the latest versions of third party tools.

## Invoking Plugin Schematics

Schematics allow you to create or modify your codebase in a simple and repeatable way. Schematics are invoked using the [`nx generate`](/{{framework/cli/generate}}) command.

```bash
nx generate [plugin]:[schematic-name] [options]
nx generate @nrwl/react:component mycmp --project=myapp
```

It is important to have a clean git working directory before invoking a schematic so that you can easily revert changes and re-invoke the schematic with different inputs.
