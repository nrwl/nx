---
title: 'Using Apollo GraphQL with Angular in an Nx Workspace'
slug: 'using-apollo-graphql-with-angular-in-an-nx-workspace'
authors: ['Philip Fulcher']
cover_image: '/blog/images/2020-01-30/1*qO6-3btZuTW7s5-q5nIkew.png'
tags: [nx, release]
---

Nx is a set of extensible dev tools for monorepos. Because of the robust support for a diverse ecosystem of JavaScript development, it enables you to build your entire full-stack application in a single repo. This allows you to share code and interfaces between your frontend and backend and acts as a multiplier on your development velocity.

GraphQL is a query language for your API. Because of its typed schema definition, it’s a great candidate for defining the contract between your API and its consumers. By using smart tools to generate code based on that schema, you can save yourself a lot of time and enforce better cooperation between your frontend and backend.

In this article, you will build a simple GraphQL API that tracks some information about Lego sets. You’ll create this API using NestJS, and it will be consumed by an Angular application. You’ll have this all inside of an Nx Workspace in a single repository.

In this article, you’ll learn how to:

- Create an Nx workspace for both frontend and backend applications
- Create a GraphQL API using NestJS
- Autogenerate frontend code based on your GraphQL schema
- Create an Angular application to consume your GraphQL api

An example repo with all of the work you’ll be doing here can be found at [https://github.com/nrwl/nx-apollo-angular-example](https://github.com/nrwl/nx-apollo-angular-example)

## Create a new workspace

Start by creating an Nx workspace:

```shell
npx create-nx-workspace@latest nx-apollo-angular-example
```

When prompted, answer the prompts as follows:

```text
npx create-nx-workspace@latest nx-apollo-angular-example
? What to create in the new workspace angular-nest      [a workspace with a
full stack application (Angular + Nest)]
? Application name                    nx-apollo
? Default stylesheet format           CSS
```

![](/blog/images/2020-01-30/1*17U-yzBfoMgkFpuawnmUnw.avif)

## Create GraphQL API

The angular-nest preset for your workspace has already created a Nest app for you named `api`. Install the GraphQL modules needed for Nest:

```shell
npm install @nestjs/graphql apollo-server-express graphql-tools graphql
```

You need a GraphQL schema to create the API, so write a very simple one with a single query and a single mutation. Create a file named `schema.graphql` in the `api` application:

```graphql {% fileName="apps/api/src/app/schema.graphql" /%}
type Set {
  id: Int!
  name: String
  year: Int
  numParts: Int
}

type Query {
  allSets: [Set]
}

type Mutation {
  addSet(name: String, year: String, numParts: Int): Set
}
```

Import the `GraphQLModule` and use that schema in NestJS.

```typescript {% fileName="apps/api/src/app/app.module.ts" /%}
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    GraphQLModule.forRoot({
      typePaths: ['./**/*.graphql'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

This is already enough to see some progress when you run the `api` application.

```shell
npm start api
```

When the application is running, bring up the GraphQL playground in your browser at [http://localhost:3333/graphql](http://localhost:3333/graphql).

Here you can inspect your GraphQL schema as well as submit queries. The queries don’t return anything right now because no data has been provided. You need a resolver to do that. Create a new file in your `api` project called `set.resolver.ts`. Then add this code:

```typescript {% fileName="apps/api/src/app/set.resolver.ts" /%}
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

export interface SetEntity {
  id: number;
  name: string;
  numParts: number;
  year: string;
}

@Resolver('Set')
export class SetResolver {
  private sets: SetEntity[] = [
    {
      id: 1,
      name: 'Voltron',
      numParts: 2300,
      year: '2019',
    },
    {
      id: 2,
      name: 'Ship in a Bottle',
      numParts: 900,
      year: '2019',
    },
  ];

  @Query('allSets')
  getAllSets(): SetEntity[] {
    return this.sets;
  }

  @Mutation()
  addSet(
    @Args('name') name: string,
    @Args('year') year: string,
    @Args('numParts') numParts: number
  ) {
    const newSet = {
      id: this.sets.length + 1,
      name,
      year,
      numParts: +numParts,
    };

    this.sets.push(newSet);

    return newSet;
  }
}
```

This is a very simple resolver that holds data in memory. It returns the current contents of the sets array for the `allSets` query and allows users to add a new set using the `addSet` mutation. Add this resolver to the providers array in your app module:

```typescript {% fileName="apps/api/src/app/app.module.ts" /%}
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SetResolver } from './set.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot({
      typePaths: ['./**/*.graphql'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SetResolver],
})
export class AppModule {}
```

Go back to your GraphQL Playground and see if your queries return any data now. Try a query and a mutation:

```graphql
query allSets {
  allSets {
    id
    name
    numParts
  }
}

mutation addSet {
  addSet(name: "My New Set", numParts: 200, year: "2020") {
    id
  }
}
```

Now that the API is working, you’re ready to build a frontend to access this.

![](/blog/images/2020-01-30/1*JiTff85gB4lKHtAhykBGKQ.avif)

## Add Apollo client to Angular app

The Apollo client makes it easy to consume your GraphQL API. The Apollo team has made it easy to install by supporting the Angular CLI’s `add` command:

```shell
ng add apollo-angular
```

You now have a file in your Angular application named `graph.module.ts`. Open it up, and add the URI of your GraphQL api at the top of this file.

```typescript {% fileName="apps/nx-apollo/src/app/graphql.module.ts" /%}
const uri = 'http://localhost:3333/graphql'; // <-- add the URL of the GraphQL server here
```

## Create Angular libraries

Nx helps you break down your code into well-organized libraries for consumption by apps, so create a couple of Angular libraries to organize your work. Create a data-access library that handles communication with the backend and a feature-sets library that includes container components for displaying the Lego set data. In a real app, you might also create a ui library that includes reusable presentational components, but that is not part of this example. For more information on how to organize your Angular monorepo using Nx, read our book \_Enterprise Angular Monorepo Pattern_s by registering at [Nrwl Connect](https://connect.nrwl.io/).

To create the described libraries, run these commands:

```shell
ng generate @nrwl/angular:library data-access --style css
ng generate @nrwl/angular:library feature-sets --style css
```

![](/blog/images/2020-01-30/1*pt9Ku64TL06IF6O18CT8rA.avif)

## Setup Angular Code Generation

A tool called GraphQL Code Generator makes the development of your data-access library faster. As always, install dependencies first:

```shell
npm install --save-dev @graphql-codegen/cli @graphql-codegen/typescript-operations @graphql-codegen/typescript-apollo-angular
```

You need to create some GraphQL queries and mutations for the frontend to consume. Create a folder named `graphql` in your data-access library with a file inside called `operations.graphql`:

```graphql {% fileName="libs/data-access/src/lib/graphql/operations.graphql" /%}
query setList {
  allSets {
    id
    name
    numParts
    year
  }
}

mutation addSet($name: String!, $year: String!, $numParts: Int!) {
  addSet(name: $name, year: $year, numParts: $numParts) {
    id
    name
    numParts
    year
  }
}
```

Create a file named `codegen.yml` in the `data-access` library to configure the code generator:

```yaml {% fileName="libs/data-access/codegen.yml" /%}
overwrite: true
schema: 'apps/api/src/app/schema.graphql'
generates:
  libs/data-access/src/lib/generated/generated.ts:
    documents: 'libs/data-access/src/lib/graphql/**/*.graphql'
    plugins:
      - 'typescript'
      - 'typescript-operations'
      - 'typescript-apollo-angular'
```

This configuration grabs all of your GraphQL files and generates all of the needed types and services to consume the API.

Add a new task in `angular.json` to run this code generator:

```json5 {% fileName="angular.json" %}
{
  version: 1,
  projects: {
    'data-access': {
      // ...
      architect: {
        // ...
        generate: {
          builder: '@nrwl/workspace:run-commands',
          options: {
            commands: [
              {
                command: 'npx graphql-codegen --config libs/data-access/codegen.yml',
              },
            ],
          },
        },
      },
    },
    // ...
  },
}
```

Now you can run that task using the Angular CLI:

```shell
ng run data-access:generate
```

You should now have a folder called `generated` in your `data-access` library with a file named `generated.ts`. It contains typing information about the GraphQL schema and the operations you defined. It even has some services that make consuming this API super-fast.

To make these available to consumers, export them in the `index.ts` file of the data-access library:

```typescript {% fileName="libs/data-access/src/index.ts" /%}
export * from './lib/data-access.module';
export * from './lib/generated/generated';
```

![](/blog/images/2020-01-30/1*nbJ41jD1-r2Oe6FsLjKaOg.avif)

## Create Angular components

You now have everything needed to start building your Angular components. Create two components: a list of Lego sets and a form to add a Lego set. Use the Angular CLI to scaffold these:

```shell
ng generate @schematics/angular:component --name=SetList --project=feature-sets --export
ng generate @schematics/angular:component --name=SetForm --project=feature-sets --export
```

The `SetForm` component needs the `ReactiveFormsModule`, remember to import that into your module. Your file should look like this now:

```typescript {% fileName="libs/feature-sets/src/lib/feature-sets.module.ts" /%}
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SetFormComponent } from './set-form/set-form.component';
import { SetListComponent } from './set-list/set-list.component';

@NgModule({
  imports: [CommonModule, ReactiveFormsModule],
  declarations: [SetListComponent, SetFormComponent],
  exports: [SetListComponent, SetFormComponent],
})
export class FeatureSetsModule {}
```

In the `SetList` component, add the following:

```angular2html {% fileName="libs/feature-sets/src/lib/set-list/set-list.component.html" /%}
<ul>
  <li *ngFor="let set of sets$ | async">
    {{ set.year }} <strong>{{ set.name }}</strong> ({{ set.numParts }} parts)
  </li>
</ul>
```

```css {% fileName="libs/feature-sets/src/lib/set-list/set-list.component.css" /%}
:host {
  font-family: sans-serif;
}

ul {
  list-style: none;
  margin: 0;
}

li {
  padding: 8px;
}

li:nth-child(2n) {
  background-color: #eee;
}

span.year {
  display: block;
  width: 20%;
}
```

```typescript {% fileName="libs/feature-sets/src/lib/set-list/set-list.component.ts" /%}
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { Set, SetListGQL } from '@nx-apollo-angular-example/data-access';
import { map } from 'rxjs/operators';

@Component({
  selector: 'nx-apollo-angular-example-set-list',
  templateUrl: './set-list.component.html',
  styleUrls: ['./set-list.component.css'],
})
export class SetListComponent {
  sets$: Observable<Set[]>;

  constructor(private setListGQL: SetListGQL) {
    this.sets$ = this.setListGQL
      .watch()
      .valueChanges.pipe(map((result) => result.data.allSets));
  }
}
```

Notice how `SetListGQL` is imported from the data-access library. This is a service generated by GraphQL Code Generator that provides the results of the `SetList` query. Your component watches the results of this query and maps them to get the list of sets. This entire pipeline is type-safe, using the types generated by GraphQL Code Generator.

In the `SetForm` component, add the following:

```angular2html {% fileName="libs/feature-sets/src/lib/set-form/set-form.component.html " /%}
<form [formGroup]="newSetForm" (submit)="createSet()">
  <label for="name">Name</label><br />
  <input formControlName="name" /><br />

  <label for="year">Year of Release</label><br />
  <input formControlName="year" /><br />

  <label for="numParts">Number of Parts</label><br />
  <input formControlName="numParts" /><br />

  <button>Create new set</button>
</form>
```

```css {% fileName="libs/feature-sets/src/lib/set-form/set-form.component.css" /%}
form {
  font-family: sans-serif;
  border: solid 1px #eee;
  max-width: 240px;
  padding: 24px;
}

input {
  display: block;
  margin-bottom: 8px;
}
```

```typescript {% fileName="libs//feature-sets/src/lib/set-form/set-form.component.ts" /%}
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  AddSetGQL,
  SetListDocument,
  SetListQuery,
} from '@nx-apollo-angular-example/data-access';
@Component({
  selector: 'nx-apollo-angular-example-set-form',
  templateUrl: './set-form.component.html',
  styleUrls: ['./set-form.component.css'],
})
export class SetFormComponent {
  newSetForm: FormGroup;

  constructor(private addSetGQL: AddSetGQL, private fb: FormBuilder) {
    this.newSetForm = this.fb.group({
      name: ['', Validators.required],
      year: ['', Validators.required],
      numParts: [100, Validators.required],
    });
  }

  createSet() {
    if (this.newSetForm.valid) {
      const newSet = {
        name: this.newSetForm.get('name').value,
        year: this.newSetForm.get('year').value,
        numParts: +this.newSetForm.get('numParts').value,
      };

      this.addSetGQL.mutate(newSet);

      this.addSetGQL
        .mutate(newSet, {
          update: (store, result) => {
            const data: SetListQuery = store.readQuery({
              query: SetListDocument,
            });
            data.allSets = [...data.allSets, result.data.addSet];
            // Write our data back to the cache.
            store.writeQuery({ query: SetListDocument, data });
          },
        })
        .subscribe(() => {
          this.newSetForm.reset();
        });
    }
  }
}
```

Again, notice that the component imports services, queries, and typing information from the data-access library to accomplish this.

## Integrate components into the app

Final steps: import your modules, bring those new components into the app component, and add a little styling:

```typescript {% fileName="apps/nx-apollo/src/app/app.module.ts" /%}
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FeatureSetsModule } from '@nx-apollo-angular-example/feature-sets';
import { AppComponent } from './app.component';
import { GraphQLModule } from './graphql.module';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, GraphQLModule, FeatureSetsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

```angular2html {% fileName="apps/nx-apollo/src/app/app.component.html" /%}
<h1>My Lego Sets</h1>
<div class="flex">
  <nx-apollo-angular-example-set-form></nx-apollo-angular-example-set-form>
  <nx-apollo-angular-example-set-list></nx-apollo-angular-example-set-list>
</div>
```

```css {% fileName="apps/nx-apollo/src/app/app.component.css" /%}
h1 {
  font-family: sans-serif;
  text-align: center;
}

.flex {
  display: flex;
}

nx-apollo-example-set-list {
  flex: 1;
  padding: 8px;
}
```

If your API isn’t running already, go ahead and start it:

```shell
npm start api
```

And now start your Angular app:

```shell
npm start nx-apollo
```

Browse to [http://localhost:4200](http://localhost:4200) and see the results of your work!

![](/blog/images/2020-01-30/1*xinJYjJKdIwUDScdRVodcQ.avif)

## Further Reading

### Read our other blog for a React Example:

- [Using Apollo GraphQL with React in an Nx Workspace](/blog/using-apollo-graphql-with-react-in-an-nx-workspace)

### NestJS

- [GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start)

### Apollo Angular

- [Apollo Angular Client](https://www.apollographql.com/docs/angular/)

### GraphQL Code Generator

- [Documentation](https://graphql-code-generator.com/)
