# Migrate from @nx-dotnet/core

This generator helps you migrate from the community-maintained `@nx-dotnet/core` plugin to the official `@nx/dotnet` plugin.

## Usage

```bash
nx g @nx/dotnet:migrate-from-nx-dotnet
```

## What It Does

The migration generator automates the following tasks:

1. **Installs @nx/dotnet plugin** - Adds the official plugin to your workspace
2. **Migrates configuration** - Transfers settings from `.nx-dotnet.rc.json` to `nx.json`
3. **Updates package.json** - Removes old packages and adds new ones
4. **Cleans up** - Optionally removes the `.nx-dotnet.rc.json` file

## Configuration Migration

The generator automatically migrates:

### ✅ Fully Automated

- **inferredTargets** - Moved to plugin options in `nx.json`
- **Plugin registration** - Configures `@nx/dotnet` in `nx.json`
- **Named inputs** - Sets up `production` input with proper exclusions
- **Package dependencies** - Removes old packages, adds new ones

### ⚠️ Manual Steps Required

- **Module boundaries** - Must be migrated to [Nx Conformance rules](https://nx.dev/docs/enterprise/powerpack/conformance)
- **NuGet package versions** - Consider using [Directory.Packages.props](https://learn.microsoft.com/nuget/consume-packages/central-package-management)
- **Solution file management** - Use `dotnet sln add` manually
- **Custom executors** - Configure `serve` and `lint` targets manually

## Options

| Option               | Type      | Default | Description                                       |
| -------------------- | --------- | ------- | ------------------------------------------------- |
| `interactive`        | `boolean` | `true`  | Show interactive prompts for decisions            |
| `removeNxDotnetCore` | `boolean` | `true`  | Remove @nx-dotnet/core packages from package.json |
| `removeRcFile`       | `boolean` | `true`  | Remove .nx-dotnet.rc.json file after migration    |
| `skipPackageJson`    | `boolean` | `false` | Do not update package.json dependencies           |
| `skipFormat`         | `boolean` | `false` | Skip formatting files                             |

## Examples

### Interactive Migration (Default)

```bash
nx g @nx/dotnet:migrate-from-nx-dotnet
```

This will show you a summary of changes and ask for confirmation before proceeding.

### Non-Interactive Migration

```bash
nx g @nx/dotnet:migrate-from-nx-dotnet --interactive=false
```

### Keep .nx-dotnet.rc.json File

```bash
nx g @nx/dotnet:migrate-from-nx-dotnet --removeRcFile=false
```

Useful if you want to manually review the old configuration.

### Dry Run (Keep Old Packages)

```bash
nx g @nx/dotnet:migrate-from-nx-dotnet --removeNxDotnetCore=false
```

## After Migration

Once the generator completes, follow these steps:

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 2. Verify Project Graph

```bash
nx graph
```

Ensure all your .NET projects are still detected correctly.

### 3. Test Builds

```bash
nx run-many -t build
```

### 4. Manual Migrations

If you had any of these features configured:

#### Module Boundaries

Migrate to Nx Conformance rules in `nx.json`:

```json
{
  "conformance": {
    "rules": [
      {
        "rule": "@nx/core:enforce-module-boundaries",
        "options": {
          "depConstraints": [
            {
              "sourceTag": "scope:api",
              "onlyDependOnLibsWithTags": ["scope:api", "scope:shared"]
            }
          ]
        }
      }
    ]
  }
}
```

#### Central Package Management

Create `Directory.Packages.props` at workspace root:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Microsoft.Extensions.Logging" Version="8.0.0" />
  </ItemGroup>
</Project>
```

#### Serve Target

Add to `targetDefaults` in `nx.json`:

```json
{
  "targetDefaults": {
    "serve": {
      "command": "dotnet watch run",
      "options": {
        "cwd": "{projectRoot}"
      }
    }
  }
}
```

#### Lint Target

Add to `targetDefaults` in `nx.json`:

```json
{
  "targetDefaults": {
    "lint": {
      "command": "dotnet format --verify-no-changes"
    }
  }
}
```

## Troubleshooting

### Generator Says "@nx-dotnet/core is not installed"

This generator only works if you currently have `@nx-dotnet/core` installed. If you're starting fresh, use:

```bash
nx g @nx/dotnet:init
```

### Configuration Not Migrating

Ensure your `.nx-dotnet.rc.json` file is valid JSON. The generator will warn you if it cannot parse the file.

### Tests Failing After Migration

1. Clear the Nx cache: `nx reset`
2. Rebuild projects: `nx run-many -t build`
3. Check for `.NET SDK version compatibility (requires .NET 8+)

## More Information

For a complete comparison of features and migration guide, see:

- [NX_DOTNET_COMPARISON.md](../../../../../NX_DOTNET_COMPARISON.md) (in repository root)
- [Nx Dotnet Plugin Docs](https://nx.dev/nx-api/dotnet)
