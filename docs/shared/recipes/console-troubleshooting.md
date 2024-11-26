# Troubleshoot Nx Console Issues

Often, issues with Nx Console are the result of underlying issues with Nx. Make sure to read the [Nx installation troubleshooting docs](/troubleshooting/troubleshoot-nx-install-issues) for more help.

## VSCode + nvm Issues

VSCode loads a version of Node when it starts. It can use versions set via [`nvm`](https://github.com/nvm-sh/nvm) but there are some caveats.

- If you've installed Node outside of `nvm` (for example using the Node installer or `brew` on Mac), VSCode will always use that version. You can check by running `nvm list` and looking for a `system` alias. To enable VSCode to pick up your `nvm` version, make sure to uninstall the version of Node that was installed outside of `nvm`.
- VSCode will load the `default` alias from `nvm` at startup. You can set it by running `nvm alias default [version]`. The `default` alias needs to be set in your OS' default terminal for VSCode to pick it up. Setting it in a VSCode-integrated terminal won't persist after it's closed. Similarly, setting it in a third-party app like iTerm won't influence VSCode by default.
- VSCode only loads the `default` version when the app is first started. This means that in order to change it, you need to close all VSCode windows and restart the app - running `Reload Window` won't work.
- If you work with lots of different Node versions, there are various VSCode extensions available to dynamically run `nvm use` whenever you open a new integrated terminal. Search for `nvm`.
- You can set a static version by using a launch configuration with `runtimeVersion` set. Refer to [this guide](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_multi-version-support).

We try to make noticing discrepancies easier by showing you the currently loaded Node version on startup. To enable this, toggle the `nxConsole.showNodeVersionOnStartup` setting in VSCode.

## JetBrains WSL Support

The Node interpreter under Languages & Frameworks > Node.js needs to be configured to use the Node executable within the WSL distribution. You can read more on the [official Jetbrains docs](https://www.jetbrains.com/help/webstorm/how-to-use-wsl-development-environment-in-product.html#ws_wsl_node_interpreter_configure).
