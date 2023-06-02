# Publishing Storybook: One Storybook instance per scope

This guide extends the
[Using Storybook in a Nx workspace - Best practices](/packages/storybook/documents/best-practices) guide. In that guide, we discussed the best practices of using Storybook in a Nx workspace. We explained the main concepts and the mental model of how to best set up Storybook. In this guide, we are going to see how to put that into practice, by looking at a real-world example. We are going to see how you can publish one Storybook per scope (eg. theme, app, framework) for your workspace.

Sometimes, you have multiple apps and libraries, and each of these is associated with a specific scope. You can read more about grouping libraries and scoping them in the [Library Types](/more-concepts/library-types) documentation page, and also in the [Code Organization and Naming Conventions](/more-concepts/monorepo-nx-enterprise#code-organization-&-naming-conventions) documentation section.

In this case, you can have one Storybook instance per scope. If you follow the folder organization convention described above, it is easy to configure Storybook to import all the stories under a specific folder, for example, which are associated with a specific app or scope.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/storybook-publishing-strategies-single-framework" /%}

## Structure of the folders

Say, for example, that you have a client app, an admin app, and a number of UI libraries, organized under the name of each app. So you would have a folder structure that looks like this:

```text
happynrwl/
├── apps/
│   ├── client/
│   ├── client-e2e/
│   ├── admin/
│   ├── admin-e2e/
│   ├── client-ui-header-e2e/
│   ├── admin-ui-dashboard-e2e/
│   └── shared-ui-cta-e2e/
├── libs/
│   ├── client/
│   │   ├── feature/
│   │   ├── ui/
|   │   │   ├── header/
|   |   |   |   ├── .storybook/
|   |   |   |   ├── src/
|   |   |   |   |   ├──lib
|   |   |   |   |   |   ├──my-header
|   |   |   |   |   |   |   ├── my-header.component.ts
|   |   |   |   |   |   |   ├── my-header.component.stories.ts
|   |   |   |   |   |   |   └── etc...
|   |   |   |   |   |   └── etc...
|   |   |   |   |   └── etc...
|   |   |   |   ├── README.md
|   |   |   |   ├── tsconfig.json
|   |   |   |   └── etc...
│   │   └── utils/
│   ├── admin/
│   │   ├── feature/
│   │   ├── ui/
|   │   │   ├── dashboard/
|   |   |   |   ├── .storybook/
|   |   |   |   ├── src/
|   |   |   |   |   ├── etc..
|   |   |   |   ├── README.md
|   |   |   |   ├── tsconfig.json
|   |   |   |   └── etc...
│   │   └── utils/
│   └── shared/
│       ├── ui/
|       │   ├── cta/
|       |   |   ├── .storybook/
|       |   |   ├── src/
|       |   |   |   ├── etc..
|       |   |   ├── README.md
|       |   |   ├── tsconfig.json
|       |   |   └── etc...
│       └── utils/
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

In this case you can see that we have two deployable applications, `client` and `admin`, and we have a number of UI libraries, each associated with a specific app. For example, `client-ui-header` is a UI library associated with the `client` app, and `admin-ui-dashboard` is a UI library associated with the `admin` app. We also have one more library, the `shared-ui-cta` library, which is shared between the two apps. The way we have structured our folders is such that any new library that is related to the `client` app will go in the `libs/client` folder, and in that folder we have a sub-folder to determine if the new library is related to `ui` or anything else. The same applies to the `admin` app. Any library shared between the two apps will live under a subfolder of the `libs/shared` folder.

Notice how we have already generated Storybook configuration and stories for all of our `ui` libraries. We have also generated a `e2e` application for each of these `ui` libraries, which is going to use the corresponding Storybook instance to run end-to-end tests.

## Setting up the thematic Storybook instances

Now, we want to have one Storybook instance per _thematic scope_. This is quite easy to implement since we are following this specific folder structure.

First of all, we need to generate three new libraries (or as many as our "thematic scopes"), which will host all the stories for each specific scope. We can do this following the same steps described above.

It's important to note that if we want to combine stories from different libraries in the same Storybook instance, _the stories need to use the same framework_.

Let's assume in this case that all our libraries are using Angular.

### Generate the libraries

Let's generate three Angular libraries, one for each scope, and let's call them `storybook-host-client`, `storybook-host-admin`, and `storybook-host-shared`. We can do this by running the following commands:

```shell
nx g @nx/angular:lib storybook-host-client
nx g @nx/angular:lib storybook-host-admin
nx g @nx/angular:lib storybook-host-shared
```

### Generate the Storybook configuration for the libraries

Now, we need to generate Storybook configuration for all these new libraries. We don't want to generate `stories` or a new Cypress project for these libraries, so we can run the following commands:

```shell
nx g @nx/storybook:configuration storybook-host-client --uiFramework=@storybook/angular
nx g @nx/storybook:configuration storybook-host-admin --uiFramework=@storybook/angular
nx g @nx/storybook:configuration storybook-host-shared --uiFramework=@storybook/angular
```

### Import the stories

Now that our Storybook configuration is ready for our new libraries, we can go ahead and import the stories!

Thanks to our folder structure, we can easily configure Storybook to import all the stories under a specific folder, for example, which are associated with a specific scope.

For example, `libs/storybook-host-admin/.storybook/main.js`:

```javascript {% fileName="libs/storybook-host-admin/.storybook/main.js" %}
module.exports = {
  core: { builder: 'webpack5' },
  stories: ['../../admin/ui/**/src/lib/**/*.stories.ts'],
  addons: ['@storybook/addon-essentials'],
};
```

And don't forget the `libs/storybook-host-admin/.storybook/tsconfig.json`:

```json {% fileName="libs/storybook-host-admin/.storybook/tsconfig.json" %}
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true
  },
  "exclude": ["../**/*.spec.ts"],
  "include": ["../../admin/ui/**/src/lib/**/*.stories.ts", "*.js"]
}
```

## Use cases that apply to this solution

- Workspaces with multiple apps and libraries, all using a single framework

- Workspaces that use scopes and follow the suggested folder structure

- Workspaces that have multiple apps and libs divided by theme and by framework, that do not mind having more than one Storybook

## Extras - Dependencies

In this example, you can still use the implicit dependencies to manually tell Nx which projects your new libraries depend on.
