# Using Storybook in a Nx workspace - Best practices

## Purpose of this guide

The purpose of this guide is to help you [set up Storybook in your Nx workspace](/packages/storybook) so that you can get the most out of Nx and its powerful capabilities.

## When to use Storybook

Usually, Storybook is mainly used for two reasons. Testing and documentation. You can read more on when and why to use Storybook in the [Why Storybook in 2022?](https://storybook.js.org/blog/why-storybook-in-2022/) article and also in the [Introduction to Storybook](https://storybook.js.org/docs/react/get-started/introduction) documentation page.

### Testing

Storybook helps you test your UIs. You can read more about testing with Storybook in the [How to test your UIs with Storybook](https://storybook.js.org/docs/react/writing-tests/introduction) documentation page. Essentially, Storybook uses the stories as a starting point for testing.

### Documentation

Storybook helps you document your UI elements, or your design system, effectively and in an interactive way. You can read more in the [How to document components](https://storybook.js.org/docs/react/writing-docs/introduction) documentation page. Essentially, you can use Storybook to publish a catalog of your components. A catalog that you can share with the design team, the developer team, the product team, anyone else in the product development process, or even the client. The components are isolated, interactive, and can be represented in all possible forms that they can take (eg. for a button: enabled, disabled, active, etc). You can read more about publishing your Storybook in the [Publish Storybook](https://storybook.js.org/docs/react/sharing/publish-storybook) documentation page.

## Nx and Storybook

Now let’s see how Nx can be used to accommodate both of these pillars of Storybook. Nx takes lots of the burden off your arms when setting up Storybook initially. It essentially provides you with all that you need to start using Storybook’s capabilities (testing and documentation) right away, without having to write a single line of code.

### Development tools

First, let’s see what Nx offers, when you are in the process of developing a project with Storybook.

#### Configuration generation

You can generate the Storybook configuration files and settings using the Nx [`@nrwl/storybook:configuration` generator](/packages/storybook/generators/configuration). You can read more about configuring Storybook with Nx in our [`@nrwl/storybook` package overview page](/packages/storybook#generating-storybook-configuration). With Nx, you configure Storybook for each individual project.

#### Stories generation

If you are on a project using Angular, React or React Native, you can also generate stories for your components. You can do so either by using each package's `storybook-configuration` generators or by using the `stories` generator, if you already have Storybook configured for your project.

If your project is not configured yet, check out one of these guides:

- [Set up Storybook for React Projects](/storybook/overview-react)

- [Set up Storybook for Angular Projects](/storybook/overview-angular)

If your project is [already configured](/packages/storybook), you can use the `stories` generator:

- [React stories generator](/packages/react/generators/stories)

- [React Native stories generator](/packages/react-native/generators/stories)

- [Angular stories generator](/packages/angular/generators/stories)

The stories generator will read your inputs (if you’re using Angular), or your props (if you're using React), and will generate stories with the corresponding arguments/controls already prefilled.

#### Cypress tests generation

Nx also generates Cypress tests for your components, that point to the corresponding component’s story. You can read more about how the Cypress tests are generated and how they look like in the [storybook-configuration generator documentation](/storybook/overview-react#cypress-tests-for-stories).

Take a look at the generated code of the Cypress test file, specifically at the URL which Cypress visits:

```javascript
cy.visit(
  '/iframe.html?id=buttoncomponent--primary&args=text:Click+me!;padding;style:default'
);
```

Cypress visits the URL that hosts the story of the component we are testing, adding values to its controls (eg. `args=text:Click+me!`). Then, the test attempts to validate that the values are correctly applied.

### CI/CD tools

Now let’s see how Nx helps in the CI/CD journey, as well.

#### Cypress testing

When you are running the Cypress tests for a project, Cypress will start the Storybook server of that project. The Storybook server will fire up a Storybook instance, hosting all the components's stories for that project. The e2e tests will then run, which actually visit the stories and perform the tests there. Cypress will be configured to start and stop the Storybook server. The results will be cached, and they will go through the Nx graph, meaning that Nx will know if the tests need to be run again or not, depending on the affected status of your project.

#### Serve

When you are configuring Storybook, Nx [adds a serve and a build target for Storybook](/packages/storybook#generating-storybook-configuration) in your `project.json`, as we explained above. You can use these targets to [serve](/packages/storybook/executors/storybook) and [build](/packages/storybook/executors/build) storybook locally, and also in production. Cypress will also use these targets when firing up the e2e tests. While developing, you can serve your Storybooks locally to see if your components work and look as expected. This can help you and speed up the development and debugging process (no need to fire up a complex dev stack).

#### Build and deploy

The build and deploy step usually comes in handy when you are ready to use Storybook for documentation, and you want to publish it. The [building](/packages/storybook/executors/build) step of Storybook is integrated in the Nx ecosystem, as explained above, and you can trigger your Storybook builds as you would trigger any other build inside your workspace.

When you publish your organization’s Storybook, as a result, ideally, you would want to have one shareable Storybook page/application living under one URL, that you can share. With Nx, you can build your Storybook and it will be ready for deployment. **However**, at this point, you have one Storybook per project in your workspace, and you could end up with far too many Storybooks that are built and ready for deployment. This is not ideal, and does not accomplish the ultimate goal of “one shareable documentation page”.

In the following section, we are going to see how to set up Storybook in these cases, to get the most out of Nx.

## How to set up Storybook to get the most out of Nx

### Philosophy

Setting up Storybook on Nx reflects - and takes advantage of - the [mental model](/concepts/mental-model) of Nx, and especially the architecture of [Applications and Libraries](/more-concepts/applications-and-libraries). What that means, in essence, is that you still maintain the individual Storybook instances (per project) which you use for testing and local development, but you also keep one extra “container” for publishing, that serves as a single entry point. Let’s see this in more detail.

#### Local development and testing

##### Development and debugging

In the process of setting up Storybook in your Nx workspace that we described above, you end up with one Storybook instance per project. That way, you can use your project’s Storybook targets to serve and build Storybook:

```bash
nx storybook my-project
```

and

```bash
nx build-storybook my-project
```

This feature is extremely useful when developing locally. The containerized stories in your Storybook are the only ones that are built/served when you want to debug just one component, or just one library. You don’t have to wait for a huge Storybook containing all your stories in your repository to fire up. You just need to wait for the Storybook of a single project to start. This speeds up the process.

##### E2e tests with Cypress

If you’re using Cypress, and you’re taking advantage of the generated Cypress tests that our Storybook generators generate, then your e2e tests are also going to be much faster. When you run your e2e tests for a particular project, Cypress is only going to start the specific Storybook instance, and it’s going to take much less time than having to start an all-including universal Storybook.

##### Caching, affected, dependency management

Since each Storybook, in this case, is attached to a project, so is the serving of Storybook and the building of Storybook and the e2e tests for that project. That means that Nx is aware of these tasks, so it caches them, it knows when to fetch them from the cache or re-run them according to the affected status of that project. It also knows that project’s dependencies and knows which things to rebuild before each task.

#### Publishing

When you are publishing your Storybook, you can follow the same principles described in the [Applications and Libraries Mental Model](/more-concepts/applications-and-libraries#mental-model) documentation page. The general idea is to have one central Storybook container, into which you are going to gather your stories from multiple libraries.

You can think of the central Storybook container as a grouping of similar-concept or same-scope UI parts of your workspace. In the same way you are scoping libraries, you can group your stories as well.

Then, according to your use-case, you can have one central Storybook for your whole workspace, importing all the stories from all the projects. Alternatively, you can have one Storybook per "scope", which imports all the stories from projects the same scope. Or even one Storybook per application, importing all the stories of all the libraries that it is depending on. As you can see, there are many options, and you can choose the one that best suits your needs.

{% callout type="note" title="Storybook Composition" %}
In order to achieve some of the things mentioned above, you may use [Storybook Composition](/storybook/storybook-composition-setup). However, in this case, you would still need to build each project’s Storybook individually, and also deploy it individually. So in the cases where you have multiple projects, Storybook Composition would not be very efficient.
{% /callout %}

Before moving on to the examples section, it could be useful to read the [Library Types](/more-concepts/library-types) documentation page and the [Grouping libraries](/more-concepts/grouping-libraries) documentation page. These could help you decide which way fits your use case better.

## Examples / Use cases

### One main Storybook instance for all projects in the workspace

This case would work if all your projects (applications and libraries) containing stories that you want to use are using the same framework (Angular, React, Vue, etc). The reason is that you will be importing the stories in a central host Storybook's `.storybook/main.js`, and we will be using one specific builder to build that Storybook. Storybook does not support mixing frameworks in the same Storybook instance.

Let’s see how we can implement this solution:

{% github-repository url="https://github.com/mandarini/nx-recipes/tree/storybook/publishing-recipe-1/storybook-recipes/publishing-strategies-single-framework" /%}

#### Steps

##### Generate a new library that will host our Storybook instance

According to the framework you are using, use the corresponding generator to generate a new library. Let’s suppose that you are using React and all your stories are using `@storybook/react`:

```bash
nx g @nrwl/react:library storybook-host
```

Now, you have a new library, which will act as a shell/host for all your stories.

##### Configure the new library to use Storybook

Now let’s configure our new library to use Storybook, using the [`@nrwl/storybook:configuration` generator](/packages/storybook/generators/configuration). Run:

```bash
nx g @nrwl/storybook:configuration –-name:storybook-host
```

and choose the framework you want to use (in our case, choose `@storybook/react`).

This generator will only generate the `storybook` and `build-storybook` targets in our new library's `project.json` (`libs/storybook-host/project.json`), and also the `libs/storybook-host/.storybook` folder. This is all we care about. We don’t need any stories in this project, since we will be importing the stories from other projects in our workspace. So, if you want, you can delete the contents of the `src/lib` folder. You may also delete the `lint` and `test` targets in `libs/storybook-host/project.json`. We will not be needing those.

##### Import the stories in our library's main.js

Now it’s time to import the stories of our other projects in our new library's `./storybook/main.js`.

Here is a sample `libs/storybook-host/.storybook/main.js` file:

```javascript
const rootMain = require('../../../.storybook/main');
module.exports = {
  ...rootMain,
  core: { ...rootMain.core, builder: 'webpack5' },
  stories: ['../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [...rootMain.addons, '@nrwl/react/plugins/storybook'],
};
```

Notice how we only link the stories matching that pattern. According to your workspace set-up, you can adjust the pattern, or add more patterns, so that you can match all the stories in all the projects you want.

For example:

```javascript
stories: ['../../**/ui/**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
          '../../**/src/lib/**/*.stories.@(js|jsx|ts|tsx|mdx)',
          etc.
         ],
```

##### Import the stories in Storybook’s tsconfig.json

If you are using Angular, do not forget to import the stories in the TypeScript configuration of Storybook.

Here is a sample `libs/storybook-host-angular/.storybook/tsconfig.json` file:

```json
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

##### Serve or build your Storybook!

Now you can serve or build your Storybook as you would, normally. And then you can publish the bundled app!

```bash
nx storybook storybook-host
```

or

```bash
nx build-storybook storybook-host
```

#### Use cases that apply to this solution

Can be used for:

- Workspaces with multiple apps and libraries, all using a single framework

Ideal for:

- Workspaces with a single app and multiple libraries all using a single framework

#### Extras - Dependencies

Your new Storybook host, essentially, depends on all the projects from which it is importing stories. This means whenever one of these projects updates a component, or updates a story, our Storybook host would have to rebuild, to reflect these changes. It cannot rely on the cached result. However, Nx does not understand the imports in `libs/storybook-host/.storybook/main.js`, and the result is that Nx does not know which projects the Storybook host depends on, based solely on the `main.js` imports. The good thing is that there is a solution to this. You can manually add the projects your Storybook host depends on as implicit dependencies in your project’s `project.json`, in the implicit dependencies array.

For example, `libs/storybook-host/project.json`:

```json
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

### One Storybook instance per scope (or per app)

Sometimes, you have multiple apps and libraries, and each of these is associated with a specific scope. You can read more about grouping libraries and scoping them in the [Library Types](/more-concepts/library-types) documentation page, and also in the [Code Organization and Naming Conventions](/more-concepts/monorepo-nx-enterprise#code-organization-&-naming-conventions) documentation section.

In this case, you can have one Storybook instance per scope. If you follow the folder organization convention described above, it is easy to configure Storybook to import all the stories under a specific folder, for example, which are associated with a specific app or scope.

{% github-repository url="https://github.com/mandarini/nx-recipes/tree/storybook/publishing-recipe-1/storybook-recipes/publishing-strategies-single-framework" /%}

#### Structure of the folders

Say, for example, that you have a client app, an admin app, and a number of UI libraries, organized under the name of each app. So you would have a folder structure that looks like this:

```treeview
happynrwl/
├── .storybook/
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

#### Setting up the thematic Storybook instances

Now, we want to have one Storybook instance per _thematic scope_. This is quite easy to implement since we are following this specific folder structure.

First of all, we need to generate three new libraries (or as many as our "thematic scopes"), which will host all the stories for each specific scope. We can do this following the same steps described above.

It's important to note that if we want to combine stories from different libraries in the same Storybook instance, _the stories need to use the same framework_.

Let's assume in this case that all our libraries are using Angular.

##### Generate the libraries

Let's generate three Angular libraries, one for each scope, and let's call them `storybook-host-client`, `storybook-host-admin`, and `storybook-host-shared`. We can do this by running the following commands:

```bash
nx g @nrwl/angular:lib storybook-host-client
nx g @nrwl/angular:lib storybook-host-admin
nx g @nrwl/angular:lib storybook-host-shared
```

##### Generate the Storybook configuration for the libraries

Now, we need to generate Storybook configuration for all these new libraries. We don't want to generate `stories` or a new Cypress project for these libraries, so we can run the following commands:

```bash
nx g @nrwl/storybook:configuration storybook-host-client --uiFramework=@storybook/angular
nx g @nrwl/storybook:configuration storybook-host-admin --uiFramework=@storybook/angular
nx g @nrwl/storybook:configuration storybook-host-shared --uiFramework=@storybook/angular
```

##### Import the stories

Now that our Storybook configuration is ready for our new libraries, we can go ahead and import the stories!

Thanks to our folder structure, we can easily configure Storybook to import all the stories under a specific folder, for example, which are associated with a specific scope.

For example, `libs/storybook-host-admin/.storybook/main.js`:

```javascript
const rootMain = require('../../../.storybook/main');
module.exports = {
  ...rootMain,
  core: { ...rootMain.core, builder: 'webpack5' },
  stories: ['../../admin/ui/**/src/lib/**/*.stories.ts'],
  addons: [...rootMain.addons],
};
```

And don't forget the `libs/storybook-host-admin/.storybook/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "emitDecoratorMetadata": true
  },
  "exclude": ["../**/*.spec.ts"],
  "include": ["../../admin/ui/**/src/lib/**/*.stories.ts", "*.js"]
}
```

#### Use cases that apply to this solution

- Workspaces with multiple apps and libraries, all using a single framework

- Workspaces that use scopes and follow the suggested folder structure

- Workspaces that have multiple apps and libs divided by theme and by framework, that do not mind having more than one Storybook

#### Extras - Dependencies

In this example, you can still use the implicit dependencies to manually tell Nx which projects your new libraries depend on.

### One Storybook instance using Storybook Composition

In this case, we are dealing with a Nx workspace that uses multiple frameworks. Essentially, you would need to have one Storybook host for each of the frameworks, containing all the stories of that specific framework, since the Storybook builder can not handle multiple frameworks simultaneously.

However, there is still the option to combine all the hosts into one single Storybook instance, using _Storybook composition_.

Let’s assume that you have a structure like the one described in the previous example, and your `client` app and the `client` libs are written in Angular, and the `admin` app the `admin` libs are written in React.

First of all, you have to create two Storybook host apps, one for Angular and one for React. Let’s call them `storybook-host-angular` and `storybook-host-react`, which are configured to import all the Angular stories and all the React stories accordingly.

Now, we are going to combine the two Storybook host apps into one, using Storybook composition. You can read our [Storybook Composition guide](/storybook/storybook-composition-setup) for a detailed explanation for how Storybook Composition works. In a nutshell, you can have one “host” Storybook instance running, where you can link other running Storybook instances.

{% github-repository url="https://github.com/mandarini/nx-recipes/tree/storybook/publishing-recipe-1/storybook-recipes/publishing-strategies-multiple-frameworks" /%}

#### Steps

We are going to assume that you are at the state where you already have your `storybook-host-angular` and `storybook-host-react` set up and ready to go.

##### Generate a Storybook host library

It does not matter which framework you use for the host Storybook library. It can be any framework really, and it does not have to be one of the frameworks that are used in the hosted apps. The only thing that is important is for this host library to have _at least one story_. This is important, or else Storybook will not load. The one story can be a component, for example, which would work like a title for the application, or any other introduction to your Storybook you see fit.

So, let’s use React for the Storybook Composition host library:

```bash
nx g @nrwl/react:lib storybook-host
```

Now that your library is generated, you can write your intro in the generated component (you can also do this later, it does not matter).

##### Generate Storybook configuration for the host library

Since you do need a story for your host Storybook, you should use the React storybook configuration generator, and actually choose to generate stories (not an e2e project though):

```bash
nx g @nrwl/react:storybook-configuration –-name=storybook-host
```

And choose `yes` to generate stories, and `no` to generate a Cypress app.

##### Change the Storybook port in the hosted apps

Now it’s important to change the Storybook ports in the `storybook-host-angular` and `storybook-host-react`. Go to the `project.json` of each of these libraries (`libs/storybook-host-angular/project.json` and `libs/storybook-host-react/project.json`), find the `storybook` target, and set the port to `4401` and `4402` accordingly. This is because the Storybook Composition host is going to be looking at these ports to find which Storybooks to host, and which Storybook goes where.

##### Add the `refs` to the main.js of the host library

Create the composition in `libs/storybook-host/.storybook/main.js`:

```javascript
const rootMain = require('../../../.storybook/main');
module.exports = {
  ...rootMain,
  core: { ...rootMain.core, builder: 'webpack5' },
  refs: {
    'angular-stories': {
      title: 'Angular Stories',
      url: 'http://localhost:4401',
    },
    'react-stories': {
      title: 'React Stories',
      url: 'http://localhost:4402',
    },
  },
  stories: ['../src/lib/**/*.stories.tsx'],
  addons: [...rootMain.addons, '@nrwl/react/plugins/storybook'],
};
```

##### Serve the Storybook instances

You can now start your three Storybook instances, and see the composed result.

In three separate terminals run the following commands:

```bash
nx storybook storybook-host-angular
nx storybook storybook-host-react
nx storybook storybook-host
```

Then navigate to [http://localhost:4400](http://localhost:4400) to see the composed result.

#### Deployment

To deploy the composed Storybooks you need to do the following:

1. Deploy the `storybook-host-angular` Storybook
2. Deploy the `storybook-host-react` Storybook
3. Change the `refs` in `libs/storybook-host/.storybook/main.js` to point to the URLs of the deployed Storybooks mentioned above
4. Deploy the `storybook-host` Storybook

#### Use cases that apply to this solution

- Workspaces with multiple apps and libs using more than one framework

## Conclusion

In this guide, we have given a direction towards the most efficient way to use Storybook in a Nx workspace, in a way that takes advantage of the all that Nx has to offer.
We have covered the different ways to set up Storybook, and publish it, too. We have also covered the different use cases that apply to each of the solutions.

If you have any questions or suggestions, please feel free to reach out to us on [GitHub](https://github.com/nrwl/nx), and don't hesitate to ask your questions or share your stories in our [Nx community Slack](https://join.slack.com/t/nrwlcommunity/shared_invite/zt-1fmyh7hib-MsIDqDDxoutA1gqeFHCnyA).

### Nx & Storybook documentation

You can find all Storybook-related Nx documentation in the [packages page](/packages#storybook).
