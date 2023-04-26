# Nx Console Keyboard Shortcuts

If you find yourself running the same command many times, here are few tips to save yourself some key strokes.

**Rerun Last Task**

If you want to rerun the last task with all the same options specified, bring up the Command Palette (`⇧⌘P`) and choose `Rerun Last Task`.

**Keyboard Shortcuts**

You can also set up custom tasks and assign keyboard shortcuts to them. In `.vscode/tasks.json` add a task like this:

```json {% fileName=".vscode/tasks.json" %}
{
  "label": "Test Affected",
  "type": "shell",
  "command": "nx affected -t test"
}
```

Then from the Command Palette (`⇧⌘P`) choose `Preferences: Open Keyboard Shortcuts (JSON)`. Then add the following shortcut:

```json
{
  "key": "ctrl+cmd+t",
  "command": "workbench.action.tasks.runTask",
  "args": "Test Affected"
}
```

Now, pressing `^⌘T` will run `nx affected -t test`.

Here is more information on [VSCode tasks](https://code.visualstudio.com/docs/editor/tasks) and [keyboard shortcuts](https://code.visualstudio.com/docs/getstarted/keybindings).
