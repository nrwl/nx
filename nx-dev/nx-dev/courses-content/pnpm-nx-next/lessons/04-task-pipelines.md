---
title: 'Create a Task Pipeline to Build Your Next app Before Serving it'
videoUrl: 'https://youtu.be/_U4hu6SuBaY'
duration: '3:07'
---

All Next.js projects usually come with these `package.json` scripts:

```json {% fileName="package.json" %}
{
    ...
    "scripts": {
        ...
        "build": "next build",
        "start": "next start"
    }
}
```

Running `next start` will only work if the `.next` folder is present in the project's root. This folder is created when running `next build`.

This is a very simple use case of a [task pipeline](/docs/concepts/task-pipeline-configuration), which defines dependencies among tasks.

In this lesson we're going to create a simple task pipeline such that whenever you run `next start`, Nx will automatically run `next build` (or restore it from the cache).

## Relevant Links

- [Defining a Task Pipeline](/docs/guides/tasks--caching/defining-task-pipeline)
