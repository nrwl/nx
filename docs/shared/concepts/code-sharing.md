# Code Sharing

One of the most obvious benefits of having a monorepo is that you can easily share code across projects. This enables you to apply the Don't Repeat Yourself principle across the whole codebase. Code sharing could mean using a function or a component in multiple projects. Or code sharing could mean using a typescript interface to define the network API interface for both the front end and back end applications.

Code sharing is usually a good thing, but it can cause problems.

## Too Much Sharing

If everyone can use and modify every piece of code, you can run into problems:

### Devs Modifying Another Team's Code

Another team can add complexity to code that your team maintains to satisfy their one use case. This adds an extra burden on you and may make it difficult to adapt that piece of code for other use cases. This can be solved by using a CODEOWNERS file that explicit defines which people in an organization need to approve PRs that touch a particular section of the codebase.

### Outside Devs Using Internal Code

Another team can use a piece of code that is intended to be internal to your project. Now if you change that piece of code, their project is broken. So your team is either locked in to that API or you have to solve problems in another team's project. To solve this, Nx provides a lint rule `enforce-module-boundaries` that will throw an error if a project imports code that is not being exported from the `index.ts` file at the root of a library. Now the `index.ts` file is the definitive published API for that library.

### Projects Depending on the Wrong Libraries

Libraries with presentational components can accidentally use code from a library that holds a data store. Projects with Angular code can accidentally use code from a React project. Projects from team A could accidentally use code in projects that are intended to be only for team B. These kinds of rules will vary based on the organisation, but they can all be enforced automatically using tags and the `enforce-module-boundaries` lint rule.
