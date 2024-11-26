# Folder Structure

Nx can work with any folder structure you choose, but it is good to have a plan in place for the folder structure of your monorepo.

Projects are often grouped by _scope_. A project's scope is either the application to which it belongs or (for larger applications) a section within that application.

## Move Generator

Don't be too anxious about choosing the exact right folder structure from the beginning. Projects can be moved or renamed using the [`@nx/workspace:move` generator](/nx-api/workspace/generators/move).

For instance, if a project under the `booking` folder is now being shared by multiple apps, you can move it to the shared folder like this:

```shell
nx g move --project booking-some-project shared/some-project
```

## Remove Generator

Similarly, if you no longer need a project, you can remove it with the [`@nx/workspace:remove` generator](/nx-api/workspace/generators/remove).

```shell
nx g remove booking-some-project
```

## Example Workspace

Let's use Nrwl Airlines as an example organization. This organization has two apps, `booking` and `check-in`. In the Nx workspace, projects related to `booking` are grouped under a `libs/booking` folder, projects related to `check-in` are grouped under a `libs/check-in` folder and projects used in both applications are placed in `libs/shared`. You can also have nested grouping folders, (i.e. `libs/shared/seatmap`).

The purpose of these folders is to help with organizing by scope. We recommend grouping projects together which are (usually) updated together. It helps minimize the amount of time a developer spends navigating the folder tree to find the right file.

```text
apps/
  booking/
  check-in/
libs/
  booking/                 <---- grouping folder
    feature-shell/         <---- project

  check-in/
    feature-shell/

  shared/                  <---- grouping folder
    data-access/           <---- project

    seatmap/               <---- grouping folder
      data-access/         <---- project
      feature-seatmap/     <---- project
```

## Sharing Projects

One of the main advantages of using a monorepo is that there is more visibility into code that can be reused across many different applications. Shared projects are a great way to save developers time and effort by reusing a solution to a common problem.

Let’s consider our reference monorepo. The `shared-data-access` project contains the code needed to communicate with the back-end (for example, the URL prefix). We know that this would be the same for all libs; therefore, we should place this in the shared lib and properly document it so that all projects can use it instead of writing their own versions.

```text
  libs/
    booking/
      data-access/           <---- app-specific project

    shared/
      data-access/           <---- shared project

      seatmap/
        data-access/         <---- shared project
        feature-seatmap/     <---- shared project
```
