---
title: 'Taming Code Organization with Module Boundaries in Nx'
slug: 'mastering-the-project-boundaries-in-nx'
authors: ['Miroslav Jonaš']
cover_image: '/blog/images/2021-12-17/1*PIUl1QGk7mOpSFdEwFQ8OA.png'
tags: [nx]
---

As your repository grows, it becomes more challenging to organize and name the applications and libraries. This organization, when done right, feels intuitive and allows team members to easily find projects and understand how they work together. When done poorly, it results in a mess we eventually end up calling “the legacy software”. This article will show you different ways how you can prevent your repo from descending into chaos.

Our book [Enterprise Angular Monorepo Patterns](https://go.nx.dev/angular-enterprise-monorepo-patterns-new-book) presents an in-depth guide to assist you with naming and organization. If you still haven’t read this book, we warmly recommend you do. Don’t let the name fool you, though — the architecture guidelines explained in this book apply to any framework.

On large projects, you will most likely find multiple teams working on different parts of the solution. Those projects are usually split into logical domains, where each team focuses on a single domain. Each domain block can have a clear public API which other domains can use to consume the information.

But the code organization is just one piece of the puzzle. The physical organization does not prevent developers from consuming the domains or parts of those domains, that should otherwise be outside of their reach. Nx ships with `enforce-module-boundaries` ESLint rule that helps restrict that possibility.

## Understanding the default configuration

When you generate the first project in your workspace using one of our generators, one of the things you get for free is the full linter setup. The linter is preconfigured with a default ruleset that includes a set of best practices. Alongside the standard set of rules, the initial generated configuration includes a setup for `enforce-module-boundaries` rule.

```json5 {% fileName=".eslintrc.json" %}
{
  // ... default ESLint config here

  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      rules: {
        '@nrwl/nx/enforce-module-boundaries': [
          'error',
          {
            allow: [],
            depConstraints: [
              {
                sourceTag: '*',
                onlyDependOnLibsWithTags: ['*'],
              },
            ],
            enforceBuildableLibDependency: true,
          },
        ],
      },
    },

    // ... more ESLint overrides here
  ],
}
```

Let’s dissect what each of these properties does.

The `allow` array acts as a whitelist listing the import definitions that should be omitted from further checks. You can read more about it in the **Overriding the overrides** section below.

The `depConstraints` section is the one you will be spending most time fine-tuning. It represents an array of constraints, each consisting of `sourceTag` and `onlyDependOnLibsWithTags` properties. The default configuration has a wildcard `*` set as a value for both of them, meaning that any project can import (depend on) any other project.

> Note, the wildcard only applies to libraries. Applications and E2E applications cannot be imported. It wouldn’t make any sense. If you want to combine applications, you should use the [micro-frontends](/recipes/angular/dynamic-module-federation-with-angular) approach with the module federation.

The circular dependency chains such as `lib A -> lib B -> lib C -> lib A` are also not allowed. The self circular dependency (when lib imports from a named alias of itself), while not recommended, can be overridden by setting the flag `allowCircularSelfDependency` to true.

```json5 {% fileName=".eslintrc.json" %}
// ... more ESLint config here

"@nrwl/nx/enforce-module-boundaries": [
  "error",
  {
    "allowCircularSelfDependency": true,
    "depConstraints": [
      // ...list of constraints
    ]
  }
]

// ... more ESLint config here
```

Finally, the flag `enforceBuildableLibDependency` prevents us from importing a non-buildable library into a buildable one. You can read more on what buildable libraries are used for in [our docs](/concepts/buildable-and-publishable-libraries).

## Using tags to enforce boundaries

To best express the need for the boundaries and assist us through the explanation, we will be using the repository represented by the following graph:

![](/blog/images/2021-12-17/1*z3ap5kyCXG4p8bcBQXx9tA.avif)
_The graph representation of the repository_

Our repository consists of two applications — Store and Admin. Each of them is composed of several feature libraries — Products (for Store), Sales, and Invoices (for Admin). Also, both of these applications depend on the Core library, and every project in our repo depends on our Shared library. Using common sense, we would like to enforce certain boundaries:

- A shared or core library should not be able to depend on a feature library
- A feature library can depend on another feature library or a shared library

First, we will use the project configuration to annotate our projects with `tags`.

- Tags used to live in `nx.json` but were in the recent version moved closer to the project, so you can locate them now in your `project.json` or `workspace.json`

Let’s define the types of projects. We will use the following tags:

- `type:app` for application
- `type:feature` for feature library
- `type:util` for utility library

Your changed project configuration should now have the tags section defined.

```json5 {% fileName="project.json" %}
{
  // ... more project configuration here

  tags: ['type:app'],
}
```

Your enhanced graph will now look similar to this:

![](/blog/images/2021-12-17/1*kTiRazA4qhZ7kD-lGgGyjg.avif)
_Graph with type tags set_

The above list of library types is not complete. You might add specific ones for E2E projects or UI component libraries. Using the naming format `type:*` is just a suggestion. Consider this being a hashtag on your favorite social app. You can use any prefix or format you feel fitting. The important thing is that it's readable and intuitive to all the members of your team.

Now, that we have marked all of our projects, we can continue to define the rules in the root `.eslintrc.json.`

```json5 {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  '@nrwl/nx/enforce-module-boundaries': [
    'error',
    {
      // update depConstraints based on your tags
      depConstraints: [
        {
          sourceTag: 'type:app',
          onlyDependOnLibsWithTags: ['type:feature', 'type:util'],
        },
        {
          sourceTag: 'type:feature',
          onlyDependOnLibsWithTags: ['type:feature', 'type:util'],
        },
        {
          sourceTag: 'type:util',
          onlyDependOnLibsWithTags: ['type:util'],
        },
      ],
    },
  ],

  // ... more ESLint config here
}
```

## Adding a second dimension

We said that a feature library can depend on any other feature library, but there is a small catch. Our two apps could be built with a different framework so mixing feature libraries would not be possible. To avoid any future impediments, we don’t want to allow a feature library used in `Store` to depend on the feature library from `Admin` and vice versa. Additionally, only our apps should be able to load the `Core` library.

![](/blog/images/2021-12-17/1*mr_MbGgWVbBcfBhss0hNqA.avif)
_Project graph with type tags and technology badges_

Let’s add another dimension to allow such restrictions. We will define the necessary scope tags:

- `scope:store` for store app-related projects
- `scope:admin` for admin app related projects
- `scope:shared` for shared projects
- `scope:core` for core projects

Our diagram should now look like this:

![](/blog/images/2021-12-17/1*KeO1ZnEkUtmS2uj8M2rqKA.avif)
_Full project graph with two-dimensional tags_

Let us now define our missing rules!

```json5 {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  '@nrwl/nx/enforce-module-boundaries': [
    'error',
    {
      // update depConstraints based on your tags
      depConstraints: [
        // ...previous project type related rules
        {
          sourceTag: 'scope:store',
          onlyDependOnLibsWithTags: [
            'scope:store',
            'scope:shared',
            'scope:core',
          ],
        },
        {
          sourceTag: 'scope:admin',
          onlyDependOnLibsWithTags: [
            'scope:admin',
            'scope:shared',
            'scope:core',
          ],
        },
        {
          sourceTag: 'scope:core',
          onlyDependOnLibsWithTags: ['scope:shared'],
        },
        {
          sourceTag: 'scope:shared',
          onlyDependOnLibsWithTags: ['scope:shared'],
        },
      ],
    },
  ],

  // ... more ESLint config here
}
```

## Fine-grained external dependencies

You may want to constrain what external packages a project may import. In our example above, we want to make sure projects in the `scope:store` does not import any angular packages, and projects from the `scope:admin` do not import any react library. You can ban these imports using `bannedExternalImports` property in your dependency constraints configuration.

We can now enhance our rule configuration by providing additional information.

```json5 {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  '@nrwl/nx/enforce-module-boundaries': [
    'error',
    {
      // update depConstraints based on your tags
      depConstraints: [
        // ...previous project type related rules
        {
          sourceTag: 'scope:store',
          onlyDependOnLibsWithTags: [
            'scope:store',
            'scope:shared',
            'scope:core',
          ],
          // this covers all @angular pacakges
          bannedExternalImports: ['@angular/*'],
        },
        {
          sourceTag: 'scope:admin',
          onlyDependOnLibsWithTags: [
            'scope:admin',
            'scope:shared',
            'scope:core',
          ],
          // this covers react, but also react-router-dom or react-helmet
          bannedExternalImports: ['react*'],
        },
        {
          sourceTag: 'scope:core',
          onlyDependOnLibsWithTags: ['scope:shared'],
          bannedExternalImports: ['@angular/*', 'react*'],
        },
        {
          sourceTag: 'scope:shared',
          onlyDependOnLibsWithTags: ['scope:shared'],
          bannedExternalImports: ['@angular/*', 'react*'],
        },
      ],
    },
  ],

  // ... more ESLint config here
}
```

Using the wildcard `*` to match multiple projects e.g. `react*` we can save ourselves the effort of manually specifying every single project we want to ban.

## Restricting transitive dependencies

Our solution doesn’t contain only internal projects but also depends on various external NPM packages. These external dependencies are explicitly declared in our `package.json`. Unfortunately, a package is rarely an island. They often consist of a tree of transitive dependencies branching out leading to thousands of packages being installed in your `node_modules` folder. Although we have control over what version or which direct dependency we install, we have no control over what versions of what packages this dependency depends on. The transitive dependencies are often the source of our app's vulnerabilities. We can also never guarantee those dependencies will be there. Just by simply running `npm install` parent may get updated to a patch or minor version that would wipe out one of the transitive dependencies or replace it with one with breaking changes.

Therefore it’s wise not to allow developers to import transitive dependencies in their projects. Our ESLint plugin provides a simple flag to turn this restriction on.

```json5 {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here

  '@nrwl/nx/enforce-module-boundaries': [
    'error',
    {
      // ... more rule config here
      banTransitiveDependencies: true,
    },
  ],

  // ... more ESLint config here
}
```

If you now try to import a transitive dependency, your linter responds with an error. This flag is disabled by default for now, but we highly recommend you enable it.

## Overriding the overrides

Sometimes, we just need to override this configuration for a given project. The scenario for this might be testing or during the development, if we are unsure yet how a certain project will be tagged. While we strongly encourage you to plan your architecture carefully and never override the boundaries configuration, you still have an option to bale out and override it.

```json5 {% fileName=".eslintrc.json" %}
{
  // ... default ESLint config here

  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      rules: {
        '@nrwl/nx/enforce-module-boundaries': [
          'error',
          {
            // ignore any checks for these projects for now
            allow: ['a-wip-project', 'this-one-is-broken-so-ignore-it'],
            depConstraints: [
              // ...dependency constraints here
            ],
          },
        ],
      },
    },

    // ... more ESLint overrides here
  ],
}
```

## Summary

Monorepos are often viewed only from the technical side, but they also bring a shift in human resources organization. Teams that were once isolated, now have to work together on the same solution.

Having a clean separation of concerns and well-defined cohesive units helps us scale our organization more easily and gives us more confidence in our architecture. not only does Nx provide tools to speed up the overall performance, but it provides tooling to enforce the organizational constraints in an automated way.

In this post, we listed several strategies which you can use to restrict your packages from being misused or use unplanned external resources. Use them thoroughly and on time, before things go out of hand.

> Prefer a visual presentation over text? Then check out this talk recording by Juri Strumpflohner: [https://www.youtube.com/watch?v=pER_Ak1yUaA&t=687s](https://www.youtube.com/watch?v=pER_Ak1yUaA&t=687s)
