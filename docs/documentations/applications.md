# Creating an App

Adding new apps to an Nx Workspace is done by using the Angular CLI generate command. Nx has a schematic named `app` that can be used to add a new app to our workspace:

```bash
ng g app myapp
ng generate app myapp # same thing
ng generate application myapp # same thing
```

This will create a new app, will place it in the `apps` directory, and will configure the `angular.json` and `nx.json` files to support the new app. It will also configure the root `NgModule` to import the `NxModule` code so we can take advantage of things like `DataPersistence`.

# Available options

Run `ng generate app --help` to see the list of available options:

```
usage: ng generate app <name> [options]
options:
  --directory
    The directory of the new application.
  --dry-run (-d)
    Run through without making any changes.
  --force (-f)
    Forces overwriting of files.
  --inline-style (-s)
    Specifies if the style will be in the ts file.
  --inline-template (-t)
    Specifies if the template will be in the ts file.
  --prefix (-p)
    The prefix to apply to generated HTML selector of components.
  --routing
    Generates a routing module.
  --skip-package-json
    Do not add dependencies to package.json.
  --skip-tests (-S)
    Skip creating spec files.
  --style
    The file extension to be used for style files.
  --tags
    Add tags to the application (used for linting)
  --view-encapsulation
    Specifies the view encapsulation strategy.
```

Most of these options are identical to the ones supported by the default CLI application, but the following are new or different: `directory`, `routing`, and `tags`.

- `ng generate app myapp --directory=myteam` will create a new application in `apps/myteam/myapp`.
- `ng generate app myapp --routing` will configure the root `NgModule` to wire up routing, as well as add a `<router-outlet>` to the AppComponent template to help get us started.
- `ng generate app myapp --tags=shared,experimental` will annotate the created app with the two tags, which can be used for advanced code analysis. Read more below.
