# Use Nx Console

## Generate

The `Generate` action allows you to choose a generator and then opens a form listing out all the options for that generator. As you make changes to the form, the generator is executed in `--dry-run` mode in a terminal so you can preview the results of running the generator in real time.

{% youtube
src="https://www.youtube.com/embed/-nUr66MWRiE"
title="Nx Console Generate UI Form"
width="100%" /%}

**From the Command Palette**

You can also launch the `Generate` action from the Command Palette (`⇧⌘P`) by selecting `nx: generate (ui)`.

{% youtube
src="https://www.youtube.com/embed/Sk2XjFwF8Zo"
title="Nx Console Generate UI from Command Palette"
width="100%" /%}

You can even construct the generator options while staying entirely within the Command Palette. Use `⇧⌘P` to open the Command Palette, then select `nx: generate`. After choosing a generator, select any of the listed options to modify the generator command. When you're satisfied with the constructed command, choose the `Execute` command at the top of the list.

{% youtube
src="https://www.youtube.com/embed/q5NTTqRYq9c"
title="Nx Console Generate with Command Palette"
width="100%" /%}

## Run

The `Run` action allows you to choose an executor command and then opens a form listing out all the options for that executor. The frequently used executor commands `build`, `serve`, `test`, `e2e` and `lint` also have their own dedicated actions.

{% youtube
src="https://www.youtube.com/embed/rNImFxo9gYs"
title="Nx Console Run UI Form"
width="100%" /%}

**From the Command Palette**

You can also construct the executor command options while staying entirely within the Command Palette. Use `⇧⌘P` to open the Command Palette, then select `nx: test`. After choosing a project, select any of the listed options to modify the executor command options. When you're satisfied with the constructed command, choose the `Execute` command at the top of the list.

{% youtube
src="https://www.youtube.com/embed/CsUkSyQcxwQ"
title="Nx Console Run from Command Palette"
width="100%" /%}

## Common Nx Commands

You can also launch other common Nx commands with the options listed out in the Command Palette.

{% youtube
src="https://www.youtube.com/embed/v6Tso0lB6S4"
title="Nx Console Affected"
width="100%" /%}

## Projects

Clicking on the name of any project navigates to that project's `project.json` file. Clicking on the name of any executor command navigates to that executor command's definition in the `project.json` file.

Clicking the ![refresh-light.svg](./refresh-light.svg) icon next to the `PROJECTS` header repopulates the Projects pane from the `project.json` files.

Clicking the ![folder-light.svg](./folder-light.svg) icon next to a project reveals that project's folder in the VSCode Explorer pane.

Clicking the ![continue-light.svg](./continue-light.svg) icon next to an executor command executes that command without prompting for options.

{% youtube
src="https://www.youtube.com/embed/ve_N3unDqAg"
title="Nx Console Projects Pane"
width="100%" /%}

## Streamlining

If you find yourself running the same command many times, here are few tips to save yourself some key strokes.

**Rerun Last Task**

If you want to rerun the last task with all the same options specified, bring up the Command Palette (`⇧⌘P`) and choose `Rerun Last Task`.

**Keyboard Shortcuts**

You can also set up custom tasks and assign keyboard shortcuts to them. In `.vscode/tasks.json` add a task like this:

```json
{
  "label": "Test Affected",
  "type": "shell",
  "command": "nx affected --target=test"
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

Now, pressing `^⌘T` will run `nx affected --target=test`.

Here is more information on [VSCode tasks](https://code.visualstudio.com/docs/editor/tasks) and [keyboard shortcuts](https://code.visualstudio.com/docs/getstarted/keybindings).
