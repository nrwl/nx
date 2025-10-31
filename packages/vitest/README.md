# @nx/vitest

The Nx Plugin for Vitest contains executors and generators for managing Vitest tests within your Nx workspace. Vitest is a fast, modern unit test framework for JavaScript and TypeScript projects.

## Setting up @nx/vitest

### Installation

Install the `@nx/vitest` package:

```bash
nx add @nx/vitest
```

### Generate Vitest Configuration

To add Vitest configuration to an existing project:

```bash
nx g @nx/vitest:configuration --project=<project-name>
```

## Using Vitest

### Running Tests

The `@nx/vitest` plugin will automatically infer test targets for projects with Vitest configuration files:

```bash
nx test my-project
```

### Vitest Configuration

The plugin looks for Vitest configuration files in your projects:

- `vitest.config.ts`
- `vitest.config.js`
- `vite.config.ts` (with `test` property)
- `vite.config.js` (with `test` property)

When a configuration file is found, the plugin automatically creates a test target for your project.

## Plugin Configuration

You can configure the `@nx/vitest` plugin in your `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@nx/vitest",
      "options": {
        "testTargetName": "test",
        "ciTargetName": "test-ci"
      }
    }
  ]
}
```

### Plugin Options

- `testTargetName`: Name of the test target (default: `test`)
- `ciTargetName`: Name for atomized test targets in CI (optional)
- `ciGroupName`: Group name for atomized tests (optional)

## More Documentation

- [Vitest Documentation](https://vitest.dev)
- [Nx Documentation](https://nx.dev)
