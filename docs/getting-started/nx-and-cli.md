# Nx and Angular CLI

Nx **is not** a replacement for Angular CLI. It's a collection of Angular CLI power-ups (schematics and builders) that transform the CLI into a powerful tool for full-stack development.

* **An Nx workspace is an Angular CLI workspace.**
* You run same `ng build`, `ng serve` commands.
* You configure your projects in `angular.json`.
* Anything you can do in a standard Angular CLI project, you can also do in an Nx workspace.


## How?

Angular CLI is extensible. Nx extends what the CLI generates (schematics) and how the CLI runs commands (builders). 

What does Nx add? 



## Full-Stack Development

With Nx, you can build a backend application next to your Angular application in the same repository. The backend and the frontend can share code. You can connect them to enable a fantastic development experience.

*How do you do it?*

First, generate a node application.

```bash
ng g node-application backend
```

The command will use NestJS by default. If you prefer Express or you want to build your backend from scratch, pass `--framework=express` or `--framework=none`.

Second, generate an Angular application.

```bash
ng g application frontend
```

Now, add the right proxy configuration:

```json
{
    "/graphql": {
      "target": "http://localhost:3333",
      "secure": false
    }
}
```

Finally, you can run `ng serve backend` and `ng serve frontend`. There is a lot more to full-stack development in Nx, which we will cover the the guides.





## Use effective development practices pioneered at Google

Using Nx, you can implement monorepo-style development--an approach popularized by Google and used by many tech companies today (Facebook, Uber, Twitter, etc..).

*Doesn't Angular CLI support having multiple projects in the same workspace?*

Yes, starting with Angular CLI 6 you can add different types of projects to a single workspace (by default you can add applications and libraries). This is great, but is not sufficient to enable the monorepo-style development. Nx adds an extra layer of tooling to make this possible.

### Analyzing and Visualizing the Dependency Graph

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to build this dependency graph. Run `yarn dep-graph` to see the dependency diagram of your workspace.

![Dependency Diagram](./dep-graph.png)


### Imposing Constraints on the Dependency Graph

If you partition your code into well-defined cohesive units, even a small organization will end up with a dozen apps and dozens or hundreds of libs. If all of them can depend on each other freely, chaos will ensue and the workspace will become unmanageable.

To help with that Nx uses code analyses to make sure projects can only depend on each other’s well-defined public API. It also allows you to declaratively impose constraints on how projects can depend on each other.

For instance, with this configuration, when we import private client code from the admin part of our repo, we will get an error.

```
"nx-enforce-module-boundaries": [
  true,
  {
    "allow": [],
    "depConstraints": [
       {  
          "sourceTag": "shared", 
          "onlyDependOnLibsWithTags": ["shared"]
       },
       { 
          "sourceTag": "admin", 
          "onlyDependOnLibsWithTags": ["shared", "admin" ] 
       },
       { 
          "sourceTag": "client", 
          "onlyDependOnLibsWithTags": ["shared", "client" ] 
       },
       { 
          "sourceTag": "*", 
          "onlyDependOnLibsWithTags": ["*"] 
       }
     ]
  }
]
```

![Lint Error](./lint-error.png)


### Rebuilding and Retesting What is Affected

To be productive in a monorepo, you need to be able to check that your change is safe, and rebuilding and retesting everything on every change won’t scale. Nx uses code analysis to determine what needs to be rebuilt and retested.

```
yarn affected:build --base=master # reruns build for all the projects affected by a PR

yarn affected:test --base=master # reruns unit tests for all the projects affected by a PR

yarn affected:e2e --base=master # reruns e2e tests for all the projects affected by a PR
```

Nx will topologically sort the projects, and will run what it can in parallel.


### Angular CLI = Code Collocation, Nx = Monorepo

Imagine you have a regular Angular CLI workspace containing tens projects, where each project has its own suite of e2e tests. The CLI doesnt't know how the projects depend on each other, so the only way for you to make sure your PR works is to rebuild and retest all ten projects. This isn't great.

First, this makes the CI expensive--10 times more expensive in the worse case scenario. Second, e2e tests can be flaky. If you always rerun all the tests in the repo, some tests will be bound to fail for the reasons unrelated to your change. 

> Only the projects affected by your PR should be rebuilt and retested.

This is a hard requirement for monorepo-style development. Nx implements it.
 

### Automation

In addition to using the monorepo, Google is also know for its use of automation. Nx adds powerful capabilities helping your team promote best practices and ensure consistency. 


## Use Innovative Tools

Tools like Apollo, Cypress, Jest, Prettier, and NestJS have gained a lot of popularity. 

It's not the case that Apollo is always better than REST or Cypress is always better than Protractor. There are tradeoffs. But in many situations, for many projects, these innovative tools offer a lot of advantages.

Adding these tools to the dev workflow is challenging in a regular CLI project. The choice you have is not between Protractor or Cypress, but between a hacked-up setup for Cypress and a great CLI setup for Protractor. Nx changes that!

When using Nx, adding Cypress or Jest is easy:

```
ng g application myapp --e2eTestRunner=cypress --unitTestRunner=jest
```

Tests can then be run just like you would run them normally:

```
ng test myapp
ng e2e myapp
```

## Summarize

Nx is not a replacement for the CLI. It's a set of Angular CLI power-ups.

With Nx, you can:

* Do everything you can do using the CLI
* Build full-stack applications using Angular and NestJS
* Use scalable development practices such as monorepos
* Use innovative tools like Cypress and Jest


### A la carte

Most importantly, you can use these power-ups a la carte. Just want to build a single Angular application using Cypress? Nx is still an excellent choice for that.

