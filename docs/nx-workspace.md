## Nx Workspace
**Nx** is designed to help you create and build enterprise grade Angular applications. It provides an opinionated
approach to application project structure and patterns.

That approach begins with the concept of a workspace, or what we call a **Nx Workspace**. This workspace contains your 
Angular application (or applications) and any supporting libraries you create. It is a mono
repo for your application domain.

[Why a workspace (or mono repo) is needed](why-a-workspace.md)

The AngularCLI can actually be set up manually to support multiple Angular applications and referenced library
code. It doesn't do this out of the box for you though. But **Nx** does! You can use the **Nx** `new`
schematic to create a new **Nx Workspace**:

```
ng new myprojectname --collection=@nrwl/schematics
```

The `new` schematic for **Nx** handles doing all that heavy lifting for you. What you end up with is
a **Nx Workspace** with the following files/folders created:
```
apps/
libs/
.angular-cli.json
tslint.json
test.js
tsconfig.json
tsconfig.app.json
tsconfig.spec.json
tsconfig.e2e.json
```
It's similar to the standard CLI projects with a few changes:
- We have the `apps` dir where all applications are placed
- We have the `libs` dir where all custom library code is placed
- Some files have moved to the root: `tsconfigs, test.js`, so all apps and libs share them.

All of the standard AngularCLI commands are available, again because **Nx** simply extends the power of the
AngularCLI.

You can build/serve/test any of the apps by passing the app name.
```
ng build --app=myapp
```