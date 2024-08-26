---
title: 'Using Apollo GraphQL with React in an Nx Workspace'
slug: 'using-apollo-graphql-with-react-in-an-nx-workspace'
authors: ['Philip Fulcher']
cover_image: '/blog/images/2020-01-30/1*qO6-3btZuTW7s5-q5nIkew.png'
tags: [nx, tutorial]
---

Nx is a set of extensible dev tools for monorepos. Because of the robust support for a diverse ecosystem of JavaScript development, it enables you to build your entire full-stack application in a single repo. This allows you to share code and interfaces between your frontend and backend and acts as a multiplier on your development velocity.

GraphQL is a query language for your API. Because of its typed schema definition, it’s a great candidate for defining the contract between your API and its consumers. By using smart tools to generate code based on that schema, you can save yourself a lot of time and enforce better cooperation between your frontend and backend.

In this article, you will build a simple GraphQL API that tracks some information about Lego sets. You’ll create this API using NestJS, and it will be consumed by a React application. You’ll have this all inside of an Nx Workspace in a single repository.

In this article, you’ll learn how to:

- Create an Nx workspace for both frontend and backend applications
- Create a GraphQL API using NestJS
- Autogenerate frontend code based on your GraphQL schema
- Create a React application to consume your GraphQL api

An example repo with all of the work you’ll be doing here can be found at [https://github.com/nrwl/nx-apollo-react-example](https://github.com/nrwl/nx-apollo-react-example)

## Create a new workspace

Start by creating an Nx workspace:

```shell
npx create-nx-workspace nx-apollo-react-example
```

When prompted, answer the prompts as follows:

![](/blog/images/2020-01-30/1*17U-yzBfoMgkFpuawnmUnw.avif)

## Create GraphQL API

Use the NestJS framework to create your GraphQL API. First, add NestJS to your Nx workspace and create an application:

```
npm install --save-dev @nrwl/nest
nx generate @nrwl/nest:application api
```

When prompted for a directory, press enter. This will place the api application in the root of your `apps` directory.

Once the application is created, install the GraphQL modules needed for Nest

```
npm install @nestjs/graphql apollo-server-express graphql-tools graphql
```

You need a GraphQL schema to create the API, so write a very simple one with a single query and a single mutation. Create a file named `schema.graphql` in the `api` application:

Import the `GraphQLModule` and use that schema in NestJS.

This is already enough to see some progress when you run the `api` application.

```
npm start api
```

When the application is running, bring up the GraphQL Playground in your browser at [http://localhost:3333/graphql](http://localhost:3333/graphql)

Here you can inspect your GraphQL schema as well as submit queries. The queries don’t return anything right now because no data has been provided. You need a resolver to do that. Create a new file in your `api` project called `set.resolver.ts`. Then add this code:

This is a very simple resolver that holds data in memory. It returns the current contents of the sets array for the `allSets` query and allows users to add a new set using the `addSet` mutation. Add this resolver to the providers array in your app module:

Go back to your GraphQL Playground and see if your queries return any data now. Try a query and a mutation:

Now that the API is working, you’re ready to build a frontend to access this.

![](/blog/images/2020-01-30/1*JiTff85gB4lKHtAhykBGKQ.avif)

## Add Apollo client to React App

The Apollo client makes it easy to consume your GraphQL API. Install the react version of the client:

```
npm install apollo-boost @apollo/react-hooks graphql
```

Modify your `app.tsx` to provide the Apollo Client:

## Create React libraries

Nx helps you break down your code into well-organized libraries for consumption by apps, so create a couple of React libraries to organize your work. Create a `data-access` library that handles communication with the backend and a `feature-sets` library that includes container components for displaying the Lego set data. In a real app, you might also create a `ui` library that includes reusable presentational components, but that is not part of this example. For more information on how to organize your React monorepo using Nx, read our book _Effective React Development with Nx_ by registering [here](https://go.nx.dev/react-book)

To create the described libraries, run these commands:

```
nx generate @nrwl/react:library data-access --style css
nx generate @nrwl/react:library feature-sets --style css
```

![](/blog/images/2020-01-30/1*pt9Ku64TL06IF6O18CT8rA.avif)

## Setup React Code Generation

A tool called GraphQL Code Generator makes the development of your data-access library faster. As always, install dependencies first:

```

npm install --save-dev @graphql-codegen/cli @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo

```

You need to create some GraphQL queries and mutations for the frontend to consume. Create a folder named `graphql` in your `data-access` library with a file inside called `operations.graphql`:

Create a file named `codegen.yml` in the `data-access` library to configure the code generator:

This configuration grabs all of your GraphQL files and generates all of the needed types and services to consume the API.

Add a new task in `workspace.json` to run this code generator:

Now you can run that task using the Nx CLI:

```

nx run data-access:generate

```

You should now have a folder called `generated` in your `data-access` library with a file named `generated.ts`. It contains typing information about the GraphQL schema and the operations you defined. It even has some hooks that make consuming this API super-fast.

To make these available to consumers, export them in the `index.ts` of the `data-access` library:

![](/blog/images/2020-01-30/1*Svkn4vwQQURylN5-XLzURg.avif)

## Create React components

You now have everything needed to start building your React components. Create two components: a list of Lego sets and a form to add a Lego set. Use the Nx CLI to scaffold these:

```

nx generate @nrwl/react:component --name=SetList --export --project=feature-sets --style=cssnx generate @nrwl/react:component --name=SetForm --export --project=feature-sets --style=css

```

In the `SetList` component, add the following:

Notice how `useSetListQuery` is imported from the data-access library. This is a hook generated by GraphQL Code Generator that provides the results of the `SetList` query. This entire pipeline is type-safe, using the types generated by GraphQL Code Generator.

In the `SetForm` component, add the following:

Again, notice that the component imports hooks, queries, and typing information from our data-access library to accomplish this.

## Integrate components into the app

Final step: bring those new components into the app component and add a little styling:

If your API isn’t running already, go ahead and start it:

`npm start api`

And now start your React app:

`npm start nx-apollo`

Browse to [http://localhost:4200](http://localhost:4200) and see the results of your work!

![](/blog/images/2020-01-30/1*xinJYjJKdIwUDScdRVodcQ.avif)

## Further Reading

### **Read this blog for an Angular Example:**

- [Using Apollo GraphQL with Angular in an Nx Workspace](/blog/using-apollo-graphql-with-angular-in-an-nx-workspace)

### NestJS

- [GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start)

### Apollo React

- [Apollo React Client](https://www.apollographql.com/docs/react/)

### GraphQL Code Generator

- [Documentation](https://graphql-code-generator.com/)

If you liked this, follow [Nx](https://www.twitter.com/NxDevtools) on Twitter!
