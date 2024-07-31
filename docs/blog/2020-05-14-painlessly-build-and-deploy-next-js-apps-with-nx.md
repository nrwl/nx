---
title: 'Painlessly Build and Deploy Next.js Apps With Nx'
slug: 'painlessly-build-and-deploy-next-js-apps-with-nx'
authors: ['Jack Hsu']
cover_image: '/blog/images/2020-05-14/1*jf5YrKObqqmui7e8StHmrA.png'
tags: [nx, tutorial]
---

_Update (2022–02–23): Also check out our new guide for_ [_deploying Next.js to to the Vercel platform_](/recipes/react/deploy-nextjs-to-vercel)_. This is the recommended way to deploy you Nx + Next.js apps._

Nx a next generation build system with first class monorepo support, which we developed at Nrwl based on our experience working at Google and helping Fortune 500 enterprises build ambitious applications at scale.

Meanwhile, [Next.js](https://nextjs.org/) is a super cool meta-framework that is built on top of React.

In this post, we’ll show you how to easily build Next.js Apps with Nx!

One of the major benefits of the Next.js framework is how much you get out of the box, with zero configuration.

For example, to create a new app and serve a new app you can simply run:

```shell
mkdir demo && cd demo
yarn init -y
yarn add next react react-dom
mkdir pages
yarn next dev
```

Running the `dev` command will result in a dev server starting at [http://localhost:3000](http://localhost:3000/). Since we don’t have any pages, navigating to it results in a 404 page.

![](/blog/images/2020-05-14/0*Ujgqgvg4d_Z_hn7R.avif)

You can remedy this by creating a `pages/index.tsx` file that exports a React component to render the index page. I won’t go over this in detail since it’s already covered in the their [Getting Started](https://nextjs.org/learn/basics/getting-started) guide.

## Some Configurations Required

There are additional steps involved when setting up Next if you want to use different plugins. Say you want to use SCSS for styling components, then you’ll need to install and configure the `@zeit/next-sass` plugin.

```shell
yarn add --dev @zeit/next-sass
```

Then update the `next.config.js` file as follows.

```
const withSass = require('@zeit/next-sass');
module.exports = withSass({
  cssModules: true // assuming you want css modules :)
});
```

Or alternatively, if you want to use `styled-components` instead, then you don’t need a Next plugin; but you need to add the necessary dependencies, update your babel config, and then create a custom `pages/_document.tsx` component to support SSR.

The setup for styled-components is available in the Next [repo](https://github.com/zeit/next.js/tree/master/examples/with-styled-components), and it’s not hard but requires a few manual steps. So let’s see how we can create and build the same app using Nx.

## Next + Nx

Now, contrast the previous steps with Nx.

```shell
npx create-nx-workspace my-workspace \
  --appName=demo \
  --preset=next \
  --style=scss \
  --nx-cloud
```

**Note:** You can use `--style=styled-components` if you prefer that instead.

The command above will create a new Nx workspace. We can run the demo app in development mode as follows.

```
cd my-workspace
nx serve demo
```

**Note:** You will need to install `nx` globally (`npm install -g @nrwl/cli`), or use `npx nx` instead.

And that’s it! No additional installation or configuration. If you use `--style=styled-components`, then Nx will create a custom document for you that works with `styled-components`, install the necessary dependencies, and set up babel config correctly. Othewise, the `scss` version will install the `@zeit/next-sass` plugin, and update the `next.config.js` to use it.

Navigating to `http://localhost:4200` will show the generated app.

![](/blog/images/2020-05-14/0*RpgOgy1ZD_Ze-mme.avif)

You can also create new pages by running the `generate` command.

```
# Or just `nx g` for short
nx generate page About --project=demo --style=scss
```

This tells Nx to add a new `apps/demo/pages/about.tsx` component to the `demo` project that we generated earlier.

The same thing goes for new components.

```
nx g component PartyPopper --project=demo  --style=scss
```

This will generate the component under the `apps/demo/components/party-popper/` folder.

Let’s update our `PartyPopper` component and use it in the `About` page. Update your code as follows.

**apps/demo/components/party-popper/party-popper.tsx**:

```
import React from 'react';
export const PartyPopper = () => <span>🎉</span>;
export default PartyPopper;
```

**apps/demo/pages/about.tsx**:

```
import React from 'react';
import PartPopper from '../components/party-popper/party-popper';
const About = () => {
  return (
    <div>
      <h1>
        You found the about page! <PartPopper />
      </h1>
    </div>
  );
};
export default About;
```

And now when you navigate to [http://localhost:4200/about](http://localhost:4200/about) you should see the new page.

![](/blog/images/2020-05-14/0*YGQ83wv7kQp20yRq.avif)

You can also run the _generated E2E tests_ that correspond with the demo app. By default, all apps generated through Nx comes with [Cypress](https://www.cypress.io/) tests. You can run them with `nx e2e demo-e2e`, and the specs are in the `apps/demo-e2e` folder.

To recap, so far we’ve seen how we can generate a new Nx workspace with a Next app. We also saw how easy it is to generate new pages and components using the `generate` command.

**Pro-tip:** The `generate` command runs [_schematics_](/nx-api/nx/documents/generate) in Nx, while targets such as `serve` uses [_builders_](/nx-api/nx/documents/run) to perform a task. To see a full list of available schematics and builders, run `nx list @nrwl/next`.

## Building and Deploying with Nx

There are many ways to deploy your Next app. You can either export a static website or build a Node application with pre-rendering support. An exported static website is pretty simple to deploy, since it just involves pushing the `public` folder to any host that can serve HTML pages — or CDN.

In this example, we will look at how to build and deploy the pre-rendered Node application to [Heroku](https://heroku.com/).

First, will need to [Heroku CLI](https://devcenter.heroku.com/categories/command-line), so go ahead and install that if you haven’t already.

Secondly, you’ll need to login to your account, and create a new app.

```
heroku login
heroku apps:create [appName]
```

You’ll need to replace `[appName]` with your own unique name (e.g. `my-awesome-next-demo`). Make sure you replace all subsequent usages of `[appName]` with the actual application name.

Next, let’s also create a `Dockerfile` for the project so we can use Heroku’s container support.

**apps/demo/Dockerfile**:

```shell
FROM node:12-alpine
WORKDIR /app
COPY .next ./.next
COPY package.json ./package.json
RUN yarn
CMD yarn next start -p $PORT
```

Then we can add our deployment command as follows:

```
nx g [@nrwl/workspace](http://twitter.com/nrwl/workspace):run-commands deploy \
  --project demo \
  --command "cd dist/apps/demo && cp ../../../apps/demo/Dockerfile . && heroku container:login && heroku container:push web -a \[appName\] && heroku container:release web -a \[appName\]"
```

I choose to chain the commands into a single one using `&&`. You can also extract it as a shell script, such as`apps/demo/deploy.sh`, and then use `--command "sh apps/demo/deploy.sh"` instead.

**Note:** Don’t forget to replace `[appName]` with your heroku app.

And finally, we can run the production build and deploy.

```
nx build demo
nx deploy demo
```

Once the image has been pushed and released on Heroku, you can browse to your app at https://\[appName\].herokuapp.com/.

## Summary

Next is a great framework for building modern websites and applications. By using Nx with Next, you gain access even more powerful tools and abstractions that can greatly improve your development workflow.

The Nx features presented here are only the tip of the iceberg. There are a lot more awesome features to discover — such as the [distributed cache](/ci/features/remote-cache) to greatly increase productivity. To learn more about Nx, please check out [nx.dev](/nx-api/react).

Also check out our guide for deploying your [Next.js apps to Vercel](/recipes/react/deploy-nextjs-to-vercel).

## Addendum: Working in a Monorepo

You may be wondering why our `demo` app lives in the `apps` folder rather being at the root of the repo like a normal Next project. As you may have guessed, Nx sets the workspace up as a monorepo.

There are many benefits of using a monorepo; including code sharing, tooling consistency, and being able to commit changes to multiple related projects at once. The [_Getting Started guide_](/getting-started/why-nx) provides more information on this, and how Nx can help you manage your monorepo.

Imagine that you have two Next apps with a common UI library, and an express backend. Your workspace stucture may look something like this:

```
apps/
  backend/
  intranet-portal/
  marketing-website/
libs/
  ui/
```

To generate the above with Nx, you’d run this series of commands:

```shell
# Create new workspace
npx create-nx-workspace@latest happyorg \
--preset=next --appName=intranet-portal --style=csscd happyorg# Dependencies for backend app
yarn add express
yarn add --dev @nrwl/node @nrwl/nextnx g @nrwl/next:app marketing-website --style=css
nx g @nrwl/react:lib ui --style=css
nx g @nrwl/node:app backend
```

The `generate` commands above now have a package prefixed before the schematic name. In our previous examples we relied on the workspace’s default schematic (i.e. `@nrwl/next` so we could leave the package out). These packages are Nx plugins, and there are officially maintained ones, as well as some blessed community plugins. For more information on plugins you can run `nx list`, and read the [plugins docs](/plugin-registry).

Another useful feature of Nx is the ability to visualize your project dependency graph by running the `nx dep-graph` command.

## Nx Resources

- Get our [**free Nx workspaces course on youtube**](https://youtu.be/2mYLe9Kp9VM)**!**
- **Purchase our** **premium video course on advanced practices for Nx workspaces:** [**here!**](https://nxplaybook.com/p/advanced-nx-workspaces)

![](/blog/images/2020-05-14/0*a8DFg8YzZUCajyip.avif)

![](/blog/images/2020-05-14/0*O6F9Rz6kOKakFvtO.avif)

![](/blog/images/2020-05-14/0*wh7tSiv_Iiw1McNu.avif)
