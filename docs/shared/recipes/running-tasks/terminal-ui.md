---
title: Terminal UI
description: 'Learn how to leverage and configure the Nx Terminal UI when running tasks'
---

# Nx Terminal UI

In version 21, Nx provides an interactive UI in the terminal to help you view the results of multiple tasks that are running in parallel.

{% youtube
src="https://youtu.be/ykaMAh83fPM"
title="New Terminal UI for Nx" /%}

{% callout type="note" title="Windows Compatibility" %}
The initial Nx 21 release disables the Terminal UI on Windows. We are currently working on Windows support, so stay tuned.
{% /callout %}

## Enable/Disable the Terminal UI

If your terminal and environment are supported then the Terminal UI will be enabled by default when you run any tasks with `nx run`/`nx run-many`/`nx affected` in Nx v21 and later. The Terminal UI will not be used in CI environments.

If you want to manually disable the Terminal UI, you can set `NX_TUI=false` in your environment variables, or set `tui.enabled` to `false` in your `nx.json` configuration file.

```json {% fileName="nx.json" %}
{
  "tui": {
    "enabled": false
  }
}
```

## Configure the Terminal UI

There are also some configuration options that control the way the terminal UI behaves.

### Auto-Exit

By default, the Terminal UI will automatically exit 3 seconds after all relevant tasks have finished running. You can adjust this behavior in the following ways:

- Set `"tui.autoExit"` to a number to change the number of seconds to wait before auto-exiting.
- Set `"tui.autoExit"` to `false` to disable auto-exiting and keep the Terminal UI open until you manually exit it with `<ctrl>+c`.
- Set `"tui.autoExit"` to `true` to exit automatically immediately after all tasks have finished running.

```json {% fileName="nx.json" %}
{
  "tui": {
    "autoExit": 3 // Equivalent of the default behavior: auto-exit after 3 seconds
  }
}
```

## Use the Terminal UI

The terminal UI is entirely controlled through keyboard shortcuts. You can view a list of the available shortcuts by typing `?`:

![Terminal UI Help](/shared/recipes/running-tasks/tui-help.png)

You can use these commands to hide and show up to 2 tasks at a time, filter the listed tasks and interact with tasks that are prompting for user input.
