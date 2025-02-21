---
type: lesson
title: Add Nx
focus: /package.json
---

## Smart Monorepo

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=170" /%} -->

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

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
