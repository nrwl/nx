# Creating an Nx Workspace

A workspace contains your Angular application (or applications) and any
supporting libraries you create.
**It is a monorepo for your application domain.**

With Angular CLI you can add different types of projects to a single
workspace (by default you can add applications and libraries).
This is great, but is not sufficient to enable the monorepo-style development.
Nx adds an extra layer of tooling to make this possible.

The `@nrwl/schematics` library contains a binary script that provides
the command `create-nx-workspace`. That command can be used to create a
new Nx Workspace:

```bash
create-nx-workspace myworkspacename
```

This will create a new Nx Workspace using a sandboxed environment...
running the Angular CLI `ng new` command under the hood and using
the Nx schematics collection.

> Note: You can use `ng new` if you like, but it relies on globally
> installed npm packages. And we know that those can be messy.
> If your globally installed npm packages are in a bad shape,
> use the `create-nx-workspace` command.

## Add to an Existing Angular CLI workspace

If you already started your project with the Angular CLI, you can also
add Nx capabilities by running:

```bash
ng add @nrwl/schematics
```
