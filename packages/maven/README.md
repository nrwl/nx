# @nx/maven

This plugin integrates Maven projects with Nx, allowing you to use Nx's powerful features with your Maven-based Java projects.

## Features

- Automatic project discovery from `pom.xml` files
- Integration with Maven lifecycle phases (compile, test, package, install)
- Support for multi-module Maven projects
- Caching of build outputs
- Test result tracking

## Installation

```bash
npm install --save-dev @nx/maven
```

## Configuration

Add the plugin to your `nx.json`:

```json
{
  "plugins": ["@nx/maven"]
}
```

## Usage

The plugin will automatically detect Maven projects in your workspace by looking for `pom.xml` files. It will create Nx projects for each Maven module and set up the following targets:

- `compile`: Runs `mvn compile`
- `test`: Runs `mvn test`
- `package`: Runs `mvn package`
- `install`: Runs `mvn install`

You can run these targets using the standard Nx commands:

```bash
nx run my-maven-project:compile
nx run my-maven-project:test
nx run my-maven-project:package
nx run my-maven-project:install
```

## Options

You can configure the plugin by adding options to your `nx.json`:

```json
{
  "plugins": ["@nx/maven"],
  "maven": {
    "includeSubmodules": true,
    "testTargetName": "test",
    "compileTargetName": "compile",
    "packageTargetName": "package",
    "installTargetName": "install"
  }
}
```

### Available Options

- `includeSubmodules`: Whether to include submodules in the project graph (default: false)
- `testTargetName`: Name of the test target (default: "test")
- `compileTargetName`: Name of the compile target (default: "compile")
- `packageTargetName`: Name of the package target (default: "package")
- `installTargetName`: Name of the install target (default: "install")

## Multi-module Projects

For multi-module Maven projects, the plugin will:

1. Detect the parent-child relationships between modules
2. Set up proper dependencies between modules in the Nx project graph
3. Ensure modules are built in the correct order

## Caching

The plugin supports Nx's caching capabilities:

- Build outputs are cached based on input files
- Test results are cached when tests pass
- Dependencies between modules are tracked for proper cache invalidation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
