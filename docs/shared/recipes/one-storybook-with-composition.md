# Publishing Storybook: One main Storybook instance using Storybook Composition

This guide extends the
[Using Storybook in a Nx workspace - Best practices](/packages/storybook/documents/best-practices) guide. In that guide, we discussed the best practices of using Storybook in a Nx workspace. We explained the main concepts and the mental model of how to best set up Storybook. In this guide, we are going to see how to put that into practice, by looking at a real-world example. We are going to see how you can publish one single Storybook for your workspace, even you are using multiple frameworks, taking advantage of [Storybook Composition](/packages/storybook/documents/storybook-composition-setup).

In this case, we are dealing with a Nx workspace that uses multiple frameworks. Essentially, you would need to have one Storybook host for each of the frameworks, containing all the stories of that specific framework, since the Storybook builder can not handle multiple frameworks simultaneously.

However, there is still the option to combine all the hosts into one single Storybook instance, using _Storybook composition_.

Let’s assume that you have a structure like the one described in the previous example, and your `client` app and the `client` libs are written in Angular, and the `admin` app the `admin` libs are written in React.

First of all, you have to create two Storybook host apps, one for Angular and one for React. Let’s call them `storybook-host-angular` and `storybook-host-react`, which are configured to import all the Angular stories and all the React stories accordingly.

Now, we are going to combine the two Storybook host apps into one, using Storybook composition. You can read our [Storybook Composition guide](/packages/storybook/documents/storybook-composition-setup) for a detailed explanation for how Storybook Composition works. In a nutshell, you can have one “host” Storybook instance running, where you can link other running Storybook instances.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/storybook-publishing-strategies-multiple-frameworks" /%}

## Steps

We are going to assume that you are at the state where you already have your `storybook-host-angular` and `storybook-host-react` set up and ready to go.

### Generate a Storybook host library

It does not matter which framework you use for the host Storybook library. It can be any framework really, and it does not have to be one of the frameworks that are used in the hosted apps. The only thing that is important is for this host library to have _at least one story_. This is important, or else Storybook will not load. The one story can be a component, for example, which would work like a title for the application, or any other introduction to your Storybook you see fit.

So, let’s use React for the Storybook Composition host library:

```shell
nx g @nx/react:lib storybook-host
```

Now that your library is generated, you can write your intro in the generated component (you can also do this later, it does not matter).

### Generate Storybook configuration for the host library

Since you do need a story for your host Storybook, you should use the React storybook configuration generator, and actually choose to generate stories (not an e2e project though):

```shell
nx g @nx/react:storybook-configuration –-name=storybook-host
```

And choose `yes` to generate stories, and `no` to generate a Cypress app.

### Change the Storybook port in the hosted apps

Now it’s important to change the Storybook ports in the `storybook-host-angular` and `storybook-host-react`. Go to the `project.json` of each of these libraries (`libs/storybook-host-angular/project.json` and `libs/storybook-host-react/project.json`), find the `storybook` target, and set the port to `4401` and `4402` accordingly. This is because the Storybook Composition host is going to be looking at these ports to find which Storybooks to host, and which Storybook goes where.

### Add the `refs` to the main.js of the host library

Create the composition in ``:

```javascript {% fileName="libs/storybook-host/.storybook/main.js" %}
module.exports = {
  core: { builder: 'webpack5' },
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
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
};
```

### Serve the Storybook instances

You can now start your three Storybook instances, and see the composed result.

In three separate terminals run the following commands:

```shell
nx storybook storybook-host-angular
nx storybook storybook-host-react
nx storybook storybook-host
```

Then navigate to [http://localhost:4400](http://localhost:4400) to see the composed result.

## Deployment

To deploy the composed Storybooks you need to do the following:

1. Deploy the `storybook-host-angular` Storybook
2. Deploy the `storybook-host-react` Storybook
3. Change the `refs` in `libs/storybook-host/.storybook/main.js` to point to the URLs of the deployed Storybooks mentioned above
4. Deploy the `storybook-host` Storybook

## Use cases that apply to this solution

- Workspaces with multiple apps and libs using more than one framework
