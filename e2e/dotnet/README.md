# .NET E2E Tests

This directory contains end-to-end tests for the `@nx/dotnet` plugin.

## Structure

- `src/dotnet.test.ts` - Basic plugin functionality tests including project detection, build operations, and dependency management
- `src/dotnet-multi-project.test.ts` - Advanced scenarios for multi-project workspaces and complex dependency chains
- `src/utils/create-dotnet-project.ts` - Utilities for creating .NET projects in tests

## Test Coverage

### Basic Functionality (`dotnet.test.ts`)

- **Project Detection**: Verifies that .NET projects are properly detected by the plugin
- **Target Configuration**: Validates that correct targets (build, test, clean, restore, publish, pack) are created based on project types
- **Build Operations**: Tests building console applications, class libraries, and running tests
- **Project Graph**: Verifies dependency detection between .NET projects

### Multi-Project Scenarios (`dotnet-multi-project.test.ts`)

- **Multiple Projects in Same Directory**: Tests handling of multiple .NET projects in a single Nx project
- **Complex Dependency Chains**: Validates project references and build ordering
- **Framework Variations**: Tests projects targeting different .NET frameworks

## Prerequisites

The e2e tests require:

- .NET 8.0 SDK or later
- Node.js and pnpm (managed by the CI environment)

## Running Tests

```bash
# Run all .NET e2e tests
nx e2e-local e2e-dotnet

# Run specific test file
nx e2e-ci--src/dotnet.test.ts e2e-dotnet

# Run in CI mode (atomized)
nx e2e-ci e2e-dotnet
```

## CI Configuration

The tests are configured to run in CI with:

- .NET 8.0 SDK automatically installed
- Parallel execution across different agent types
- Proper isolation to avoid conflicts with other tests
