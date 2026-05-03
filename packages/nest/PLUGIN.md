# @nx/nest/plugin

The `@nx/nest/plugin` detects Nest projects by looking for `nest-cli.json`.

This initial implementation detects Nest projects only. It does not infer `build`, `serve`, `test`, or `lint` targets yet.

A detected `nest-cli.json` is treated as an Nx project when it belongs to a directory that also contains `package.json` or `project.json`.

Detected files:

- `nest-cli.json`
