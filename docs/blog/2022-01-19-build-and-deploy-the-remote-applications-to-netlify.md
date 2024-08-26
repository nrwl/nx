---
title: 'Build and Deploy the Remote Applications to Netlify'
slug: 'build-and-deploy-the-remote-applications-to-netlify'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-01-19/0*HQzdmymbKGiCBVgn.png'
tags: [nx, tutorial]
---

This is the third article in a series of articles that aims to showcase the process of scaffolding and deploying a Micro Frontend Architecture using Nx and [Netlify](https://netlify.com/). We are going to develop and independently deploy two applications to Netlify.

The two applications consist of a ToDo app, which will be non-functional and whose sole purpose is to be a placeholder to protect behind an authorization guard, and a Login app, which will provide a basic login form along with a shared auth lib containing a stateful service for managing the authed user.

## Articles in the Series

- [Introduction to Deploying MFEs with Netlify](/blog/introduction-to-deploying-angular-mfes-with-netlify)
- [Scaffold and Deploy the Dashboard to Netlify](/blog/scaffold-and-deploy-the-dashboard-to-netlify)
- **Build and Deploy the Remote Applications to Netlify**
- [Integrate the Remote apps with the Dashboard](/blog/integrate-the-remote-apps-with-the-dashboard)

or [subscribe to the newsletter](https://go.nrwl.io/nx-newsletter) to get notified when new articles get published.

## Build ToDo App

### Generate the app

Starting with the ToDo app, run the following command to generate the app with a Micro Frontend configuration.

```shell
yarn nx g @nrwl/angular:remote todo --host=dashboard
```

Let’s break down what is happening with this command.

- It generates a standard Angular app with a routing configuration.
- It adds an Angular Module that acts as a remote entry point for host applications.
- It adds a `mfe.config.js` file, exposing the Remote Entry Module to be consumed by Host applications.
- It adds a Webpack configuration using the `withModuleFederation` helper.
- It will add this application to the specified host application’s (dashboard) `mfe.config.js` file.
- It adds this application to the host application’s serve-mfe target.  
  — This target will serve all the remote applications along with the host application, launching your full Micro Frontend Architecture.
- It changes the default serve port for the application to be 1 greater than the previous highest in your workspace — i.e. your dashboard will run on 4200, so the todo app will run on 4201.

## Build the UI

We’ll start building the UI for the ToDo application by adding a route that will redirect automatically to the Remote Entry Module. This means that when we serve the ToDo app locally, we’ll see the Module that we’re working on for the MFE.

Open `apps/todo/src/app/app.module.ts` and find the `RouterModule` import in the `NgModule`. It should look like this:

Edit it to match the following:

Next, we’ll edit the `app.component.html` file to only contain the `RouterOutlet`. Open the file and delete all the contents except for

If we serve our app using `yarn nx serve todo` and navigate to [http://localhost:4201](http://localhost:4201) we should see the following:

![](/blog/images/2022-01-19/1*hh8m6Bl7o9F7kfi23pt2RQ.avif)

Our ToDo app has been configured correctly. Let’s edit the `entry.component.ts` file to show a very basic ToDo UI:

When we save the file, webpack should rebuild the changes and our output should look like this:

![](/blog/images/2022-01-19/0*t6ky5bHLQwvWRalt.avif)

That’s it. The UI for our ToDo app is complete.

## Prepare for Netlify Deployment

We have one final step before we are ready to deploy the app. We need to add a `netlify.toml`file to the `src/`folder of the ToDo app. The `netlify.toml`file is picked up by Netlify during deployment to apply certain rules to the deployed site. In this case, unlike the Dashboard application, we also need to configure CORS to allow external sites to request our resources (JavaScript files in this instance).

After creating the file, add the following to it:

To ensure, this file is copied correctly when the file is built, open up the `project.json` file for your ToDo app _(_`apps/todo/project.json`_)_ and find the `build` option. It should look like this:

Add the `netlify.toml` file to the `assets` array so that it gets copied over in place. Your `build` config should look like this:

Let’s commit our changes and push to our remote repo:

```
git add .
git commit -m “feat: build the todo application”
git push
```

The application is ready to be deployed to Netlify!

## Deploy the ToDo App

Go to [https://app.netlify.com](https://app.netlify.com). You’ll be greeted with a screen similar to this if you are logged in:

![](/blog/images/2022-01-19/0*Dgn74hKzxbuFM8g_.avif)

To set up our ToDo site, follow the steps below:

![](/blog/images/2022-01-19/1*HiRqcqS9JTWaqTAnl4ACAA.avif)

1.  Click on Add new site
2.  Click on GitHub when it prompts to Connect to Git provider.
3.  Select your repository
4.  Modify the Build command and Publish directory  
    a) Build command should be `yarn build todo`  
    b) Publish directory should be `dist/apps/todo`
5.  Click Deploy site

Netlify will then import your repository and run the build command. After the build completes, Netlify will take the built files and deploy them to a newly generated domain. You can find this domain in the Info card on the Netlify Site. Clicking on the URL will take you to your deployed application.

With that, our ToDo app is complete!

## Build the Login App

Moving on to the Login app. Here, we will build a few things:

- A Shared Auth Library that can be used by any app or library in our Micro Frontend Architecture.
- A Login library that will contain a login form and use the Auth library to set the authenticated user state.
- The Login app, which will use the Login library to render the login form.

## Scaffold the Application and Libraries

We’ll start by scaffolding the app and the libraries we’ll need:

```shell
yarn nx g [@nrwl/angular](http://twitter.com/nrwl/angular):remote login --host=dashboard
yarn nx g [@nrwl/angular](http://twitter.com/nrwl/angular):lib feat-login
yarn nx g [@nrwl/angular](http://twitter.com/nrwl/angular):lib shared/auth
```

## Add Shared Auth Logic

Now that we have our libraries ready, let’s flesh out the logic for the shared auth library. We’re going to want two things:

1.  A service that will log the user in and contain some state about the authed user
2.  A route guard that can be used to check if there is an authenticated user

We can use generators to scaffold these out also! Run the following commands to do so:

```shell
yarn nx g [@nrwl/angular](http://twitter.com/nrwl/angular):service auth --project=shared-auth
yarn nx g [@nrwl/angular](http://twitter.com/nrwl/angular):guard auth --project=shared-auth --implements=CanActivate
```

These two commands have added four files to our shared/auth library:

- libs/shared/auth/src/lib/auth.service.ts
- libs/shared/auth/src/lib/auth.service.spec.ts
- libs/shared/auth/src/lib/auth.guard.ts
- libs/shared/auth/src/lib/auth.guard.spec.ts

For convenience, we’ll ignore the test files.

We’ll start with the `auth.service.ts` file. Open the file and replace its contents with the following:

In this file, we’re doing the following:

- Creating a `BehaviorSubject` to store some state relating to our User
- Exposing an observable that can be used to read the current state of the User
- Exposing a very trustworthy method to log the User in and set the state

Next, we’ll build the Auth Guard logic to prevent unwanted routing to protected routes. Open `auth.guard.ts` and replace the contents with the following:

In this file, we use the Auth Service we created to read the state of the authenticated user, map it to a boolean value that will be used as the result of the guard. We also create a side-effect that will force navigation to the login route if the user is not authenticated.

Finally, we need to expose both the guard and the service from the library to allow them to be consumed by other libraries and applications. Open `libs/shared/auth/src/index.ts` and replace the contents with:

With that, our shared auth library is ready to be used!

## Build the Login form

Now that we have the shared auth library completed, we can focus on building the login form. We already generated the login feature (`feat-login`) library. This approach is an architectural practice promoted by Nrwl to help structure your monorepo logically. You can read more about that here: [https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book)

We need a component for our login form, so let’s generate one:

```shell
yarn nx g @nrwl/angular:component login --project=feat-login
```

First, open `libs/feat-login/src/lib/feat-login.module.ts` and add `LoginComponent` to the exports of the `NgModule` and `ReactiveFormsModule` to the `imports` array:

This allows consuming libraries and apps to import the module and use the component easily.  
Next, we’ll build the login form itself.  
Open `login.component.ts` and replace it with the following:

With this component, we create a `FormGroup` that will be used to collect user input. It also has a method for handling the submission of the login form that will use our Auth Service to authenticate the user and route us back to the root of the application, where we should now see the previously protected content.

With the logic taken care of, let’s flesh out the UI.

Open `login.component.html` and replace it with:

Finally, let’s add some CSS so it looks pretty. Open `login.component.scss` and add:

With that, the login form should be ready to be used!

## Integrate the Login form to the Login app

With the login form completed, it’s time to use it in the login application we generated earlier. Following similar steps as the ToDo application, let’s set up the routing to point to the Remote Entry Module.

Open `apps/login/src/app/app.module.ts` and find the `RouterModule` import in the `NgModule`. It should look like this:

Edit it to match the following:

Next, we’ll edit the `app.component.html` file to only contain the `RouterOutlet`. Open the file and delete all the contents except for:

Now, let’s edit the Remote Entry component to use our login form. First, we need to import it to the Remote Entry Module, so let’s open `entry.module.ts` and replace it with:

Now, let’s edit the `RemoteEntryComponent` to render our Login form. Open `entry.component.html` and replace it with:

Our Login app should be ready!

If we run `yarn nx serve login` and navigate to [http://localhost:4202](http://localhost:4202) we should see the following:

![](/blog/images/2022-01-19/0*iM5kHD_fbX-YxOW7.avif)

Awesome! We just need to add our `netlify.toml` file and we should be ready to deploy our Login app to Netlify! We’ll follow the same steps we used to create the file for the ToDo app.

## Prepare for Netlify Deployment

We need to add the `netlify.toml` file to the `src/` folder of the Login app.  
After creating the file, add the following to it:

To ensure, this file is copied correctly when the file is built, open up the `project.json` file for your Login app (`_apps/login/project.json_`_)_ and find the `build` option. It should look like this:

Add the `netlify.toml` file to the `assets` array so that it gets copied over in place. Your `build` config should look like this:

Let’s commit our changes and push to our remote repo:

```
git add .
git commit -m “feat: build the login application”
git push
```

Now the application is ready to be deployed to Netlify!

## Deploy the Login App

To deploy the Login app, we’ll follow the same steps we used to deploy the ToDo app.

1.  Go to [https://app.netlify.com](https://app.netlify.com).
2.  Click on Add new site
3.  Click on GitHub when it prompts to Connect to Git provider.
4.  Select your repository
5.  Modify the Build command and Publish directory  
    a) Build command should be `yarn build login`  
    b) Publish directory should be `dist/apps/login`
6.  Click Deploy site

Netlify will build your app then take the built files and deploy them to a newly generated domain. You can find this domain in the Info card on the Netlify Site. Clicking on the URL will take you to your deployed application.

With that, our Login app is complete!

## Summary

In this article, we built and deployed our two remote applications! This sets us up for the next article where we will use Module Federation with our Dashboard application to remotely fetch the exposed modules from our remote apps and compose them into a single system.

Blog: [https://nx/dev/blog/](/blog)  
Nx on Twitter: [https://twitter.com/NxDevTools](https://twitter.com/NxDevTools)  
Colum Ferry’s Twitter: [https://twitter.com/FerryColum](https://twitter.com/FerryColum)
