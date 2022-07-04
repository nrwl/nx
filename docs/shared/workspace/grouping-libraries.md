# Grouping Libraries

Libraries should be grouped by _scope_. A library's scope is either application to which it belongs or (for larger applications) a section within that application.

## Move Generator

Don't be too anxious about choosing the exact right folder structure from the beginning. Libraries can be moved or renamed using the [`@nrwl/workspace:move` generator](/workspace/move).

For instance, if a library under the `booking` folder is now being shared by multiple apps, you can move it to the shared folder like this:

```bash
nx g move --project booking-some-library shared/some-library
```

{% callout type="note" title="Angular" %}
For Angular projects, you should use the [`@nrwl/angular:move` generator](/packages/angular/generators/move) instead.
{% /callout %}

## Remove Generator

Similarly, if you no longer need a library, you can remove it with the [`@nrwl/workspace:remove` generator](/workspace/remove).

```bash
nx g remove booking-some-library
```

## Example Workspace

Let's use Nrwl Airlines as an example organization. This organization has two apps, `booking` and `check-in`. In the Nx workspace, libraries related to `booking` are grouped under a `libs/booking` folder, libraries related to `check-in` are grouped under a `libs/check-in` folder and libraries used in both applications are placed in `libs/shared`. You can also have nested grouping folders, (i.e. `libs/shared/seatmap`).

The purpose of these folders is to help with organizing by scope. We recommend grouping libraries together which are (usually) updated together. It helps minimize the amount of time a developer spends navigating the folder tree to find the right file.

```text
apps/
  booking/
  check-in/
libs/
  booking/                 <---- grouping folder
    feature-shell/         <---- library

  check-in/
    feature-shell/

  shared/                  <---- grouping folder
    data-access/           <---- library

    seatmap/               <---- grouping folder
      data-access/         <---- library
      feature-seatmap/     <---- library
```

## Sharing Libraries

One of the main advantages of using a monorepo is that there is more visibility into code that can be reused across many different applications. Shared libraries are a great way to save developers time and effort by reusing a solution to a common problem.

Let’s consider our reference monorepo. The `shared-data-access` library contains the code needed to communicate with the back-end (for example, the URL prefix). We know that this would be the same for all libs; therefore, we should place this in the shared lib and properly document it so that all projects can use it instead of writing their own versions.

```text
  libs/
    booking/
      data-access/           <---- app-specific library

    shared/
      data-access/           <---- shared library

      seatmap/
        data-access/         <---- shared library
        feature-seatmap/     <---- shared library
```
