---
title: Angular - Information about the Storybook targets
description: This document explains the role of the storybook and build-storybook targets in Angular projects with a Storybook configuration, and specifically which executors are used for them.
---

# Information about `storybook` and `build-storybook` targets for Angular projects with a Storybook configuration

{% callout type="note" title="Note" %}
This documentation page contains information about the [Storybook plugin](/packages/storybook), specifically regarding [Angular projects that are using Storybook](/packages/storybook/documents/overview-angular).
{% /callout %}

If you are on Nx version `>=14.1.8`, the [Nx Storybook plugin for _Angular_ projects](/packages/storybook/documents/overview-angular) uses the original Storybook executors for Angular (`"@storybook/angular:start-storybook"` and `"@storybook/angular:build-storybook"`) to serve and build Storybook.

That means that you can use the official [Storybook for Angular documentation (expand the "Troubleshooting" section)](https://storybook.js.org/docs/angular/get-started/install#troubleshooting) to configure the options for serving and building Storybook.

## Moving your project targets to the new (native Storybook) schema

If you are on Nx version `<14.1.8` and you want to move to the latest version (or any version `>=14.1.8`) you can use the `nx migrate` command, which will take care of migrating your Storybook targets across all your Angular projects using Storybook to use the new schema, the original Storybook executors for Angular. The configuration changes that you need to make will be handled automatically by Nx, so you will not have to do any manual work.

If you have already moved on a version of Nx `>=14.1.8` without using `nx migrate` and now you are having trouble with your Angular projects using Storybook (eg. `Property 'uiFramework' does not match the schema. '@storybook/angular' should be one of ...`), that means that your targets are still using the old schema and they should change. The way to fix that is to call `nx migrate` again like this:

```bash
nx migrate @nx/storybook@14.1.0 --to="@nx/storybook@14.2.0"
```

and follow the instructions that will be printed in the console.

This command will generate a new `migrations.json` file which will contain the "change-storybook-targets" migration script. This script (when called with `yarn nx migrate --run-migrations`) will change the `storybook` and `build-storybook` targets in all your Angular projects that are configured to use Storybook. The new target configuration will use the native Storybook builders (`@storybook/angular:build-storybook` and `@storybook/angular:start-storybook`) instead of the Nx Storybook builders (`@nx/storybook:build-storybook` and `@nx/storybook:storybook`).
