# Using Nx at Enterprises

Nx is a great tool for companies of all sizes. These days even small products have several microservices and several frontends (say desktop and mobile) which are often built by distributed teams. Being able to do this type of development holistically, using modern tools, is as important for a startup as it is for a well-established organization.

Some things, however, are much more important for large companies:

- Code organization & naming conventions
- Code ownership
- Enforcing best practices
- Developer workflow
- Deployment flexibility

> Everything below are just recommendations. Every large organization has unique needs, so treat this document as a starting point not the definite list of what you must and must not do.

## Code Organization & Naming Conventions

### Apps and Libs

- Apps configure dependency injection and wire up libraries. They should not contain any components, services, or business logic.
- Libs contain services, components, utilities, etc. They have well-defined public API.

A typical Nx workspace has many more libs than apps, so pay especially careful attention to the organization of the libs directory.

### Scope (Where a library lives, who owns it)

It's a good convention to put applications-specific libraries into the directory matching the application name. This provides enough organization for small to mid-size applications.

```treeview
happynrwl/
├── apps/
│   ├── happynrwlapp/
│   ├── happynrwlapp-e2e/
│   ├── adminapp/
│   └── adminapp-e2e/
├── libs/
│   ├── happynrwlapp/
│   │   ├── feature-main/
│   │   ├── ui-table/
│   │   └── utils-testing/
│   ├── adminapp/
│   │   ├── feature-main/
│   │   ├── feature-login/
│   │   ├── ui/
│   │   └── utils-testing/
│   └── shared/
│       ├── ui/
│       └── utils-testing/
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

For larger projects, it is a good idea to group libraries into application sections.

```treeview
happynrwl/
├── apps/
├── libs/
│   ├── happynrwlapp/
│   │    ├── registration/
│   │    │   ├── feature-main/
│   │    │   ├── feature-login/
│   │    │   ├── ui-form/
│   │    │   └── utils-testing/
│   │    ├── search/
│   │    │   ├── feature-results/
│   │    │   └── utils-testing/
│   │    └── shared/
│   │        └── ui/
│   ├── adminapp/
|   └── shared/
│       ├── ui/
│       └── utils-testing/
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

Here we have:

- `happynrwlapp/registration/feature-main`--a scoped library used in one place
- `happynrwlapp/shared/ui`--a shared library used in a single application
- `shared/ui`--a shared library used across applications

**Portal**

Many enterprise applications are portals: slim shells loading different modules at runtime. If this is what you are building, the following might be a better starting point:

```treeview
happynrwl/
├── apps/
│   ├── happynrwlapp/
│   ├── happynrwlapp-e2e/
├── libs/
│   ├── shell/
│   │   └── feature-main
│   ├── registration/
│   │   ├── feature-main/
│   │   ├── feature-login/
│   │   ├── ui-form/
│   │   └── utils-testing/
│   ├── search/
│   │   ├── feature-results/
│   │   └── utils-testing/
│   └── shared/
│       ├── ui/
│       └── utils-testing/
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

### Type (What is in the library)

With Nx, we can partition our code into small libraries with well-defined public API. So we can categorize our libraries based on what they contain.

**These are some common library types:**

- Utility libraries contain utilities and services.
- Data-access can contain NgRx-related code.
- Component libraries should contain presentational components and directives.
- Feature libraries contain business logic, application screens, etc.

This categorization is a good starting point, but other library types are quite common too (e.g., mock libraries). It's a good idea to establish naming conventions (e.g., `utilities-testing`, `components-buttons`). Having them helps developers explore the code and feel comfortable no matter where they are in the repository.

### Managing Dependencies

For a large organization it's crucial to establish how projects can depend on each other. For instance:

- Libraries with a broader scope (e.g., `shared/ui`) should not depend on the libraries with narrower scope (e.g., `happynrwlapp/search/utils-testing`).
- Component libraries should only depend on other component libraries and utility libraries, but should not depend feature libraries.

Nx provides a feature called tags that can be used to codify and statically-enforce these rules. Read more about tags [here](/structure/monorepo-tags).

## Code Ownership

It's crucial for a large company with multiple teams contributing to the same repository to establish clear code ownership.

Since Nx allows us to group apps and libs in directories, those directories can become code-ownership boundaries. That's why the structure of an Nx workspace often reflects the structure of an organization. GitHub users can use the `CODEOWNERS` file for that.

```bash
/libs/happynrwlapp          julie-happynrwlapp-lead
/apps/happynrwlapp          julie-happynrwlapp-lead
/libs/shared/ui             hank-the-ui-guy
/libs/shared/utils-testing  julie,hank
```

If you want to know more about code ownership on Github, please check [the documentation on the `CODEOWNERS` file](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).

## Enforcing Best Practices

When we have 10 people working on an app in the same room, we can agree on best practices over lunch. We can also make sure the team follows them by reviewing each other's PRs. For a team of a hundred located in different cities, this no longer works.

With Nx, we can help teams adopt best practices by using workspace generators and workspace lint checks.

### Workspace Generators

Generators is a library used by Nx to do code generation. `nx g lib mylib` invokes the lib generator from the default collection. Generators are a great way to codify conventions and best practices. Unfortunately, creating a custom generators collection is not very straightforward, so few do it.

Nx simplifies it. With Nx, we can create custom generators in the `tools/generators` folder and invoke them without having to do compile, build, deploy anything.

Read more about workspace generators in the Workspace Generators guide.

### Workspace Lint Checks

Custom lint checks is another great way to enforce best practices. We can create custom lint checks in the `tools/lint` directory and then register them in `tslint.json`or `.eslintrc.json`.

## Developer Workflow

Embracing the monorepo-style development often requires some changes to the development workflow.

**Our CI should run the following checks:**

- It checks that the changed code is formatted properly. (`nx format:check`)
- It runs lint checks for all the projects affected by a PR/commit.
- It runs unit tests for all the projects affected by a PR/commit.
- It runs e2e tests for all the apps affected by a PR/commit.
- It rebuilds all the apps affected by a PR/commit.

Note `all the projects affected by a PR/commit`. This is very important. Monorepo-style development only works if we rebuild, retest, and relint only the projects that can be affected by our changes. If we instead retest everything, we will get the the following problems:

- The performance of CI checks will degrade over time. The time it takes to run the CI checks should be proportional to the impact of the change, not the size of the repo.
- We will be affected by the code your change didn’t touch

We should utilize `affected:*` commands to build and test projects. Read more about them [here](/cli/affected).

### Trunk-based development

Monorepo-style development works best when used with trunk-based development.

When using trunk-based development, we have a single main branch (say `main`) where every team submits their code. And
they do it as soon as possible. So if someone works on a large feature, they split it into a few small changes that can be integrated into main in a week. In other words, when using trunk-based development, teams can create branches, but they are short-lived and focus on a specific user story.

One issue folks often raise in regards to trunk-based development is "things change under you while you are trying to create a release". This can definitely happen, especially when manual testing is involved. To mitigate we can create a release branch where we would cherry-pick commits from `main` to. With this, we can still frequently merge code into `main` and have our release isolated from changes made by other teams.
