---
title: Terminal UI
description: 'Learn how to leverage and configure the Nx Terminal UI when running tasks'
---

# Nx Terminal UI

![Terminal UI Example](/shared/recipes/running-tasks/tui-example.png)

## Enabling/Disabling the Terminal UI

If your terminal and environment are supported then the Terminal UI will be enabled by default when you run any tasks with `nx run`/`nx run-many`/`nx affected` in Nx v21 and later. The Terminal UI will not be used in CI environments.

If you want to manually disable the Terminal UI, you can set `NX_TUI=false` in your environment, or set the following in your `nx.json` configuration file.

```json {% fileName="nx.json" %}
{
  "tui": {
    "enabled": false
  }
}
```

## Configuring the Terminal UI

In addition to disabling the Terminal UI in `nx.json`, there are some additional configuration options that can be set.

### Auto-Exit

By default, the Terminal UI will automatically exit after 3 seconds once all relevant tasks have finished running. You can adjust this behavior in the following ways:

- Set `"tui.autoExitAfter"` to a number to change the number of seconds to wait before auto-exiting.
- Set `"tui.autoExitAfter"` to `false` to disable auto-exiting and keep the Terminal UI open until you manually exit it with `<ctrl>+c`.
- Set `"tui.autoExitAfter"` to `true` to exit automatically immediately after all tasks have finished running.

```json {% fileName="nx.json" %}
{
  "tui": {
    "autoExit": 3 // Equivalent of the default behavior: auto-exit after 3 seconds
  }
}
```
