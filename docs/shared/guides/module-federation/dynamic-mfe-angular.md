# Advanced Angular Micro Frontends with Dynamic Module Federation

Dynamic Module Federation is a technique that allows an application to determine the location of its remote applications at runtime. It helps to achieve the use case of **“Build once, deploy everywhere”**.

“Build once, deploy everywhere” is the concept of being able to create a single build artefact of your application and deploy it to multiple environments such as staging and production.

The difficulty in achieving this with a Micro Frontend Architecture using Static Module Federation is that our Remote applications will have a different location (or URL) in each environment. Previously, to account for this, we would have had to specify the deployed location of the Remote applications and rebuild the application for the target environment.

This guide will walk through how the concept of “Build once, deploy everywhere” can be easily achieved in a Micro Frontend Architecture that uses Dynamic Module Federation.

## Prerequisites

This guide follows the previous Angular Micro Frontend guide. It will use the same workspace that was created in that guide. If you have not completed it, you can find that guide [here](/module-federation/faster-builds).

## Aim

The aim of this guide is two-fold. We want to be able to:

- Transform an existing Static Module Federation setup to use Dynamic Federation
- Generate a new Micro Frontend application that uses Dynamic Federation

## What we’ll build

To achieve the aims, we will do the following:

- Change the Dashboard application to use Dynamic Federation
- Generate a new Employee Dashboard application that will use Dynamic Federation
  - It should use the existing Login application.
  - It should use a new Todo application.

## Converting the Dashboard application

The Dashboard application is a Host application that loads the Remote applications at runtime based on their deployed locations when the application was built.

We want to change this so that the Dashboard application can make a network request at runtime to find out the deployed locations of the Remote applications.

There are 3 steps involved with this:

- Make a network request to fetch the locations of the Remote applications _(the Remote Definitions)_.
- Set the Remote Definitions so that webpack is aware of how to find the Remote applications when requested.
- Change how we load the Remote applications so that webpack can fetch any required files correctly.

### Fetch and Set the Remote Definitions

Perhaps one of the easiest methods of fetching the Remote Definitions at runtime is to store them in a JSON file that can be present in each environment. The Host application then only has to make a GET request to the JSON file.

We’ll start by creating this file. Add a `mfe.manifest.json` file to the `src/assets/` folder in our Dashboard application with the following content:

```json
{
  "login": "http://localhost:4201"
}
```

Next, open `main.ts` under the `src/`folder and replace it with the following:

```typescript
import { setRemoteDefinitions } from '@nrwl/angular/mfe';

fetch('/assets/mfe.manifest.json')
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
```

You’ll notice that we:

- Fetch the JSON file
- Call `setRemoteDefinitions` with the contents of the JSON file
  - This tells webpack where each of our Remote applications has been deployed to!

### Change how Remotes are loaded

At the moment, webpack is statically building our application, telling it at build time where our Remotes are. That is because they are specified in the `mfe.config.js` file.

Open the `mfe.config.js` file at the root of our `apps/dashboard/` folder and set the `remotes` property to be an empty array. It should look like this:

```javascript
module.exports = {
  name: 'dashboard',
  remotes: [],
};
```

Next, we need to change how our application attempts to load the Remote when it is routed to. Open `app.module.ts` under the `src/app/`folder.

You should see the following line in the `RouterModule.forRoot()`:

```typescript
{
    path: 'login',
    loadChildren: () =>
       import('login/Module').then((m) => m.RemoteEntryModule),
}
```

Replace it with the following:

```typescript
{
    path: 'login',
    loadChildren: () =>
        loadRemoteModule('login', './Module').then(
            (m) => m.RemoteEntryModule
         ),
}
```

You will also need to add the following import to the top of the file:

```typescript
import { loadRemoteModule } from '@nrwl/angular/mfe';
```

The `loadRemoteModule` helper method simply hides some logic that will check if the Remote application has been loaded, and if not, load it, and then requests the correct exposed module from it.

### Summary

That’s all the changes required to replace Static Module Federation with Dynamic Module Federation.

Running:

```bash
nx serve-mfe dashboard
```

Should result in the same behaviour as before, except that our Dashboard application is waiting until runtime to find out the deployed location of our Login application.

In the next section, we will see how Nx’s generators can be used to automate a lot of this process for us!

---

## Creating a new Dynamic Host application

Nx provides generators that aim to streamline the process of setting up a Dynamic Micro Frontend architecture.

To showcase this, let’s create a new Host application that will use our previous Login application as well as a new Todo Remote application.

### Generate the Employee Host application

Run the following command to generate a new Host application that is preconfigured for Dynamic Federation and add specify the Login Remote application we want to add:

```bash
nx g @nrwl/angular:host employee --remotes=login --dynamic
```

This will generate:

- Angular application
- Webpack Configuration _(webpack.config.js)_
- Module Federation Configuration _(mfe.config.js)_
- Micro Frontend Manifest File _(mfe.manifest.json)_
- Changes to the bootstrap of application to fetch the Micro Frontend Manifest, set the Remote Definitions and load the Login application correctly

You should take a look at the files generated and see how the Login Remote application was added to the `mfe.manifest.json` file and the slight changes to `main.ts` and `app.module.ts` to load the Remotes dynamically.

### Generate the Todo Remote application

We’re going to demonstrate how when specifying a dynamic Host when adding a new Remote application, the Remote application will be added to the Host’s Micro Frontend Manifest file correctly.

```bash
nx g @nrwl/angular:remote todo --host=employee
```

You’ll note that this will generate the same output as the Login Remote application in the previous guide. There’s one difference.

Because the Host application is using Dynamic Federation, the new Remote will be added to the Host’s `mfe.manifest.json`.

### Summary

Dynamic Federation is the perfect way to solve the problem of **“Build once, deploy everywhere”**. It can be used in tandem with CD solutions that involve spinning up environments for different stages of the release process without having to rebuild the application at all. The CD pipeline only ever needs to replace a JSON file on that environment with one that contains the correct values for the deployed locations of the remote applications.
