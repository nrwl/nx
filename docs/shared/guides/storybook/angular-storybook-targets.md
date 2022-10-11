# Information about `storybook` and `build-storybook` targets for Angular projects with a Storybook configuration

{% callout type="note" title="Note" %}
This documentation page contains information about the [Storybook plugin](/packages/storybook), specifically regarding [Angular projects that are using Storybook](/storybook/overview-angular).
{% /callout %}

If you are on Nx version `>=14.1.8`, the [Nx Storybook plugin for _Angular_ projects](/storybook/overview-angular) uses the original Storybook executors for Angular (`"@storybook/angular:start-storybook"` and `"@storybook/angular:build-storybook"`) to serve and build Storybook.

That means that you can use the official [Storybook for Angular documentation (expand the "Troubleshooting" section)](https://storybook.js.org/docs/angular/get-started/install#troubleshooting) to configure the options for serving and building Storybook.

## Moving your project targets to the new (native Storybook) schema

If you are on Nx version `<14.1.8` and you want to move to the latest version (or any version `>=14.1.8`) you can use the `nx migrate` command, which will take care of migrating your Storybook targets across all your Angular projects using Storybook to use the new schema, the original Storybook executors for Angular. The configuration changes that you need to make will be handled automatically by Nx, so you will not have to do any manual work.

If you have already moved on a version of Nx `>=14.1.8` without using `nx migrate` and now you are having trouble with with your Angular projects using Storybook (eg. `Property 'uiFramework' does not match the schema. '@storybook/angular' should be one of ...`), that means that your targets are still using the old schema and they should change. For that, you can use the [`change-storybook-targets` generator](/packages/storybook/generators/change-storybook-targets) which will take care of changing your `storybook` and `build-storybook` targets across your workspace for your Angular projects using Storybook.
