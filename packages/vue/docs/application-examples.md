---
title: Vue application generator examples
description: This page contains examples for the @nx/vue:app generator.
---

## Examples

##### Simple Application

Create an application named `my-app`:

```shell
nx g @nx/vue:app apps/my-app
```

##### Specify style extension

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```shell
nx g @nx/vue:app apps/my-dir/my-app --style=scss
```

##### Add tags

Add tags to the application (used for linting).

```shell
nx g @nx/vue:app apps/my-app --tags=scope:admin,type:ui
```
