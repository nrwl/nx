# workspace-lint

Before Nx 15, the `workspace-lint` command performed workspace wide lint checks including:

1. Checking for projects with no files in them
2. Checking for files that do not belong to a project
3. Ensuring that all the versions of Nx packages are in sync

Checks (1) and (2) are no longer necessary because [Nx no longer uses a `workspace.json` file](../workspace-json) to define project locations. Instead, Nx dynamically detects projects anywhere in the workspace based on the presence of `package.json` or `project.json` files.

Check (3) is now accomplished manually with the [`nx report` command](/packages/nx/documents/report).

In Nx 15 and 16, `nx workspace-lint` does nothing except display a deprecation message. In Nx 17, `workspace-lint` will be completely removed.
