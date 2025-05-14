---
type: lesson
title: Add Nx
focus: /package.json
---

## Smart Monorepo

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=170" /%} -->

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

:::info

##### In-Browser Editing Tips

Instructions for each step will appear in this left-hand panel. You can edit files in the editor in the top right and execute terminal commands in the bottom right.

The file system and terminal will be reset at each step of the tutorial, so don't worry about breaking the workspace while experimenting. If you are stuck on a step, click the `Solve` button in the top right to set the file system to the solved state.

If you experience technical issues with the in-browser tutorial, try refreshing the page or use the download button in the top right to download the files for the current step to your local machine.

:::

### Add Nx

To enable Nx in your repository, run a single command:

```shell {% path="~/tuskydesigns" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

The script asks a series of questions to help set up caching for you.

- `Which scripts need to be run in order?` - Choose `build`
- `Which scripts are cacheable?` - Choose `build` and `typecheck`
- `Does the "build" script create any outputs?` - Enter `dist`
- `Does the "typecheck" script create any outputs?` - Enter nothing
- `Would you like remote caching to make your build faster?` - Choose `Skip for now`
