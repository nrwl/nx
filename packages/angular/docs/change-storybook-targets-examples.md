This generator will change the `storybook` and `build-storybook` targets in all your Angular projects that are configured to use Storybook. The new target configuration will use the native Storybook builders (`@storybook/angular:build-storybook` and `@storybook/angular:start-storybook`) instead of the Nx Storybook builders (`@nrwl/storybook:build-storybook` and `@nrwl/storybook:storybook`).

This generator is usually invoked through a migrator, when you are using `nx migrate` to upgrade your workspace to Nx `14.1.8` or later.

If you are on Nx `14.1.8` or later and you did not use `nx migrate`, you can run this generator manually by running the following command:

```bash
nx g @nrwl/angular:change-storybook-targets
```

You can read more about how this generator works, and why we are changing the Storybook targets, in the [Angular Storybook targets documentation page](/storybook/angular-storybook-targets).
