# Creating an AngularJS Upgrade Module

NgUpgrade is a library put together by the Angular team, which we can use in our application to mix and match AngularJS and Angular components and bridge the AngularJS and Angular dependency injection systems. We can call such an application a “hybrid application”, and the code required to bootstrap it an "upgrade module".

Setting up an Upgrade Module manually involves several steps and is easy to misconfigure. **Nx** provides a command that does it for you.

```console
ng generate upgrade-module legacyApp --app=myapp
```

This will add and set up `UpgradeModule`, configure `legacyApp`, and will add all the needed dependencies to `package.json`.

Open the generated `legacy-app-setup.ts` and you will find all the code needed to bridge the AngularJS and Angular applications.

## Testing Hybrid Applications

For a lot of applications, just running one command is sufficient to convert your application into a hybrid application. That's not always the case--sometimes changes are required. To make this iterative process easier, Nx creates `hybrid.spec.ts`, which you can use to make sure the upgrade module works.

## Schematic

**upgrade-module** _&lt;name&gt; &lt;options ...&gt;_

### Required

- **name** (`string`)  
  The name of the main AngularJS module.

### Options

- **app** (`string`)  
  The name of the application to add it to.
- **angularJsImport** (`string`)  
  Import expression of the AngularJS application (e.g., --angularJsImport=node_modules/my_app).
- **angularJsCmpSelector** (`string`)  
  The selector of an AngularJS component (e.g., --angularJsCmpSelector=myComponent).
- **skipPackageJson** (`boolean`)  
  Do not add @angular/upgrade to package.json (e.g., --skipPackageJson). Default is `false`.
- **router** (`boolean`)  
  Sets up router synchronization (e.g., --router). Default is `false`.

## After Upgrade Module

Nx sets up the upgrade module for you to help you get started with your upgrade process. To learn more on how to upgrade your application, once an upgrade module is set up, check out the following resources:

### Talk: Upgrading Enterprise Angular Applications

In this talk at NgConf, Victor Savkin shows how to upgrade your application gradually, component by component, module by module using NgUpgrade and the Angular Router. He discusses the common problems developers face during such migrations and the patterns that can be used to remedy them.

<a href="https://www.youtube.com/embed/izpqQpD8RQ0" class="embedly-card" data-card-width="100%" data-card-controls="0">Embedded content: https://www.youtube.com/embed/izpqQpD8RQ0</a>

### Blog: Upgrading Angular Applications

In this blog post series Victor Savkin covers similar topics but more in depth. He dives deep into NgUpgrade, including the mental model, implementation, subtleties of the API. Then he talks about different strategies for upgrading large AngularJS applications.

- [NgUpgrade in Depth](https://blog.nrwl.io/ngupgrade-in-depth-436a52298a00)
- [Upgrade Shell](https://blog.nrwl.io/upgrading-angular-applications-upgrade-shell-4d4f4a7e7f7b)
- [Two Approaches to Upgrading Angular Applications](https://blog.nrwl.io/two-approaches-to-upgrading-angular-apps-6350b33384e3)
- [Managing Routers and URL](https://blog.nrwl.io/upgrading-angular-applications-managing-routers-and-url-ca5588290aaa)
- [Using NgUpgrade like a Pro: Lazy Loading AngularJS Applications](https://blog.nrwl.io/using-ngupgrade-like-a-pro-lazy-loading-angularjs-applications-469819f5c86)

### Book: Upgrading Angular Applications

You can also get a book written by Victor Savkin on the subject [here](https://leanpub.com/ngupgrade/).
