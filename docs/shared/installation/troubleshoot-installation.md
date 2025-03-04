---
title: Troubleshoot Nx Installations
description: Learn how to resolve common Nx installation issues, including native module problems, platform compatibility, and Node.js architecture mismatches.
---

# Troubleshoot Nx Installations

Here are some common scenarios we came across while trying to run Nx on CIs

## Native Modules

Nx publishes native binaries that should be automatically downloaded and installed when Nx is used.

If you see a message saying that your platform is not supported (or that Nx cannot find a `@nx/nx-platform` module for versions of Nx between 15.8 and 16.4), there
are a few reasons why this could potentially happen:

1. Running your install command with `--no-optional` (or the relative flag in yarn, pnpm, etc)
1. Running your install with `--dev` for pnpm.
1. The package-lock.json file was not correctly updated by npm, and missed optional dependencies used by Nx.
   You can read more about this [issue on the npm repository.](https://github.com/npm/cli/issues/4828)
1. [Your platform is not supported](#supported-native-module-platforms)
1. [Node.js wasn't installed for the proper architecture ](#nodejs-installation-issues)

{% callout type="note" title="Updating Nx" %}
When updating Nx that is already on 15.8, the package-lock.json should continue to be updated properly with all the proper optional dependencies.
{% /callout %}

### How to fix

1. If you are running your install command with `--no-optional`, try again without the flag.
1. Delete your node_modules and `package-lock.json` (or other lock files) and re-run your package manager's install command.
1. If running on Windows, make sure that the [installed Microsoft Visual C++ Redistributable is up-to-date](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads).

Confirm that you see `@nx/nx-<platform-arch>` in your `node_modules` folder (e.g. `@nx/nx-darwin-arm64`, `@nx/nx-win32-x64-msvc`, etc).

If you are still experiencing issues after following the previous steps, please [open an issue on GitHub](https://github.com/nrwl/nx/issues/new?assignees=&labels=type:+bug&projects=&template=1-bug.yml) and we will help you troubleshoot.
Be prepared to give as much detail as possible about your system, we will need the following information at a minimum, the contents of `nx report` plus

- Operating system version
- The package manager (npm, yarn, pnpm, etc) install command

### Supported native module platforms

We publish modules for the following platforms:

- macOS 11+ (arm64, x64)
- Windows (arm64, x64)
  - We use the `msvc` target, so as long as Microsoft supports your Windows version, it should work on it
- Linux (arm64, x64)
  - We use `gnu` ang `musl` targets, which are used by the most popular Linux distributions
- FreeBSD (x64)

If you're running a machine that isn't part of the list above, then Nx does not support it at this time. [Please open an issue on GitHub](https://github.com/nrwl/nx/issues/new/choose) if you feel Nx should support that platform and we will assess what can be done, please make sure to include your platform and architecture in the issue.

### Node.js Installation Issues

Ensure that the architecture of your Node.js installation matches your hardware. Run `nx report` and check that the `OS` property is correct (e.g. `darwin-arm64` for MacOS on Apple silicon). If it contains `x64` even though you're on an `arm64` chip, then something is wrong. A mismatch in architecture can lead to errors loading Nx's native binary.

Often, the culprit of the mismatch is a faulty installation of your toolchain: Homebrew (MacOS), Node.js or VSCode (if using Nx Console). You should reinstall your toolchain with the correct architecture. Run `nx report` again to validate the installation.

For issues inside VSCode or Nx Console, also refer to the [Nx Console troubleshooting docs](recipes/nx-console/console-troubleshooting)
