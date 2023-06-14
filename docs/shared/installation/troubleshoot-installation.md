# Troubleshoot Nx Installations

Here are some common scenarios we came across while trying to run Nx on CIs

## Native Modules

With more recent versions of Nx, we publish native binaries that should be automatically downloaded and installed when Nx is used.

If you see a message saying that your platform is not supported (or that Nx cannot find a `@nx/nx-platform` module for versions of Nx between 15.8 and 16.4), there
are a few reasons why this could potentially happen:

1. Running your install command with `--no-optional` (or the relative flag in yarn, pnpm, etc)
1. Running your install with `--dev` for pnpm.
1. The package-lock.json file was not correctly updated by npm, and missed optional dependencies used by Nx.
   You can read more about this [issue on the npm repository.](https://github.com/npm/cli/issues/4828)
1. [Your platform is not supported](#supported-native-module-platforms)

{% callout type="note" title="Updating Nx" %}
When updating Nx that is already on 15.8, the package-lock.json should continue to be updated properly with all the proper optional dependencies.
{% /callout %}

### How to fix

1. If you are running your install command with `--no-optional`, try again without the flag.
2. Delete your node_modules and `package-lock.json` and re-run `npm i`. This should have the `package-lock.json` file updated properly.

### Supported native module platforms

We publish modules for the following platforms:

- macOS 11+ (arm64, x64)
- Windows (arm64, x64)
  - We use the `msvc` target, so as long as Microsoft supports your Windows version, it should work on it
- Linux (arm64, x64)
  - We use `gnu` ang `musl` targets, which are used by the most popular Linux distributions
- FreeBSD (x64)

If you're running a machine that isn't part of the list above, then Nx does not support it at this time. [Please open an issue on Github](https://github.com/nrwl/nx/issues/new/choose) if you feel Nx should support that platform and we will assess what can be done, please make sure to include your platform and architecture in the issue.
