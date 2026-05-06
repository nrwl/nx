# @nx/nest/plugin

The `@nx/nest/plugin` detects standard Nest CLI projects in an Nx monorepo by
looking for `nest-cli.json` and infers a small set of useful targets.

A detected `nest-cli.json` is treated as an Nx project when the same directory
also contains `package.json` or `project.json`.

Detected file:

- `nest-cli.json`

Inferred targets:

- `build`
- `serve`

The inferred targets are conservative and use Nest CLI commands from the
project root:

- `build` runs `nest build`
- `serve` runs `nest start --watch`

Current limitations:

- No Jest or Vitest target inference
- No ESLint target inference
- No full Nest workspace mode support
- Other domains remain owned by their respective Nx plugins
