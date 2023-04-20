# Troubleshoot Nx Installations

Here are some common scenarios we came across while trying to run Nx on CIs

## Native Modules

With more recent versions of Nx, we publish native binaries that should be automatically downloaded and installed when Nx is used.

Some npm users are experiencing errors like the following:

```shell
NX   Cannot find module '@nrwl/nx-linux-x64-gnu'
```

There are two reasons why this could potentially happen:

1. Running your install command with `--no-optional` (or the relative flag in yarn, pnpm, etc)
2. The package-lock.json file was not correctly updated by npm, and missed optional dependencies used by Nx.
   You can read more about this [issue on the npm repository.](https://github.com/npm/cli/issues/4828)

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

If you're running a machine that isn't part of the list above, then Nx will fall back to a non-native implementation where needed.

{% callout type="caution" title="Hash mismatches" %}
One of the places where we use native modules is for calculating file hashes. The native implementation uses xxHash, while the fallback implementations use sha.

If your CI and local machines are using different implementations (e.g. your CI is using a machine that isn't supported), cache hits will not match between local and CI runs.

You can opt out of using the native hasher by having `NX_NON_NATIVE_HASHER=true` set as an environment variable.
{% /callout %}
