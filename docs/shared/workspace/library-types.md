# Library Types

There are many different types of libraries in a workspace. In order to maintain a certain sense of order, we recommend having a small number of types, such as the below four (4) types of libraries.

**Feature libraries:**

Developers should consider feature libraries as libraries that implement smart UI (with access to data sources) for specific business use cases or pages in an application.

**UI libraries:**

A UI library contains only presentational components (also called "dumb" components).

**Data-access libraries:**

A data-access library contains code for interacting with a back-end system. It also includes all the code related to state management.

**Utility libraries:**

A utility library contains low-level utilities used by many libraries and applications.

---

## Feature Libraries

**What is it?**

A feature library contains a set of files that configure a business use case or a page in an application. Most of the components in such a library are smart components that interact with data sources. This type of library also contains most of the UI logic, form validation code, etc. Feature libraries are almost always app-specific and are often lazy-loaded.

**Naming Convention**

`feature` (if nested) or `feature-\*` (e.g., `feature-home`).

**Dependency Constraints**

A feature library can depend on any type of library.

```treeview
libs/
└── my-app/
    └── feature-home/
        └── src/
            ├── index.ts
            └── lib/
```

`feature-home` is the app-specific feature library (in this case, the "my-app" app).

---

## UI Libraries

**What is it?**

A UI library is a collection of related presentational components. There are generally no services injected into these components (all of the data they need should come from Inputs).

**Naming Convention**

`ui` (if nested) or `ui-\*` (e.g., `ui-buttons`)

**Dependency Constraints**

A ui library can depend on ui and util libraries.

---

## Data-access Libraries

**What is it?**

Data-access libraries contain code that function as client-side delegate layers to server tier APIs.

All files related to state management also reside in a `data-access` folder (by convention, they can be grouped under a `+state` folder under `src/lib`).

**Naming Convention**

`data-access` (if nested) or `data-access-\*` (e.g. `data-access-seatmap`)

**Dependency Constraints**

A data-access library can depend on data-access and util libraries.

---

## Utility Libraries

**What is it?**

A utility library contains low level code used by many libraries. Often there is no framework-specific code and the library is simply a collection of utilities or pure functions.

**Naming Convention**

`util` (if nested), or `util-\*` (e.g., `util-testing`)

**Dependency Constraints**

A utility library can depend only on utility libraries.

An example util lib module: **libs/shared/util-formatting**

```typescript
export { formatDate, formatTime } from './src/format-date-fns';
export { formatCurrency } from './src/format-currency';
```

## Other Types

You will probably come up with other library types that make sense for your organization. That's fine. Just keep a few things in mind:

- Keep the number of library types low
- Clearly document what each type of library means
