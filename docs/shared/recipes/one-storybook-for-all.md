# Publishing Storybook: One main Storybook instance for all projects

This guide extends the
[Using Storybook in a Nx workspace - Best practices](/packages/storybook/documents/best-practices) guide. In that guide, we discussed the best practices of using Storybook in a Nx workspace. We explained the main concepts and the mental model of how to best set up Storybook. In this guide, we are going to see how to put that into practice, by looking at a real-world example. We are going to see how you can publish one single Storybook for your workspace.

This case would work if all your projects (applications and libraries) containing stories that you want to use are using the same framework (Angular, React, Vue, etc). The reason is that you will be importing the stories in a central host Storybook's `.storybook/main.js`, and we will be using one specific builder to build that Storybook. Storybook does not support mixing frameworks in the same Storybook instance.

Let’s see how we can implement this solution:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/storybook-publishing-strategies-single-framework" /%}

## Steps

### Generate a new library that will host our Storybook instance

According to the framework you are using, use the corresponding generator to generate a new library. Let’s suppose that you are using React and all your stories are using `@storybook/react`:

```shell
nx g @nx/react:library storybook-host
```

Now, you have a new library, which will act as a shell/host for all your stories.

### Configure the new library to use Storybook

Now let’s configure our new library to use Storybook, using the [`@nx/storybook:configuration` generator](/packages/storybook/generators/configuration). Run:

```shell
nx g @nx/storybook:configuration storybook-host
```

and choose the framework you want to use (in our case, choose `@storybook/react`).

This generator will only generate the `storybook` and `build-storybook` targets in our new library's `project.json` (`libs/storybook-host/project.json`), and also the `libs/storybook-host/.storybook` folder. This is all we care about. We don’t need any stories in this project, since we will be importing the stories from other projects in our workspace. So, if you want, you can delete the contents of the `src/lib` folder. You may also delete the `lint` and `test` targets in `libs/storybook-host/project.json`. We will not be needing those.

### Import the stories in our library's main.js

Now it’s time to import the stories of our other projects in our new library's `./storybook/main.js`.

Here is a sample `libs/storybook-host/.storybook/main.js` file:

```javascript {% fileName="libs/storybook-host/.storybook/main.js" %}
module.exports = {
  core: { builder: 'webpack5' },
  stories: ['../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
};
```

Notice how we only link the stories matching that pattern. According to your workspace set-up, you can adjust the pattern, or add more patterns, so that you can match all the stories in all the projects you want.

For example:

```javascript
stories: [
  '../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  '../../**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  // etc...
];
```

### Import the stories in Storybook’s tsconfig.json

If you are using Angular, do not forget to import the stories in the TypeScript configuration of Storybook.

Here is a sample `libs/storybook-host-angular/.storybook/tsconfig.json` file:

```json {% fileName="libs/storybook-host-angular/.storybook/tsconfig.json" %}
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true
  },
  "exclude": ["../**/*.spec.ts"],
  "include": ["../../**/ui/**/src/lib/**/*.stories.ts", "*.js"]
}
```

Notice how in the `include` array we are specifying the paths to our stories, using the same pattern we used in our `.storybook/main.js`.

### Serve or build your Storybook!

Now you can serve or build your Storybook as you would, normally. And then you can publish the bundled app!

```shell
nx storybook storybook-host
```

or

```shell
nx build-storybook storybook-host
```

## Use cases that apply to this solution

Can be used for:

- Workspaces with multiple apps and libraries, all using a single framework

Ideal for:

- Workspaces with a single app and multiple libraries all using a single framework

## Extras - Dependencies

Your new Storybook host, essentially, depends on all the projects from which it is importing stories. This means whenever one of these projects updates a component, or updates a story, our Storybook host would have to rebuild, to reflect these changes. It cannot rely on the cached result. However, Nx does not understand the imports in `libs/storybook-host/.storybook/main.js`, and the result is that Nx does not know which projects the Storybook host depends on, based solely on the `main.js` imports. The good thing is that there is a solution to this. You can manually add the projects your Storybook host depends on as implicit dependencies in your project’s `project.json`, in the implicit dependencies array.

For example, `libs/storybook-host/project.json`:

```json {% fileName="libs/storybook-host/project.json" %}
{
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/storybook-host/src",
  "projectType": "library",
  "tags": ["type:storybook"],
  "implicitDependencies": [
    "admin-ui-footer",
    "admin-ui-header",
    "client-ui-footer",
    "client-ui-header",
    "shared-ui-button",
    "shared-ui-main",
    "shared-ui-notification"
  ],
```
