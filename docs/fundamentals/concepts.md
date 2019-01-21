# Workspace

A workspace is a folder and single Git repository, that contains your
Angular application (or applications) and any supporting libraries you create.
It is a monorepo for your application domain.

With Angular CLI you can add different types of projects to a single workspace
(by default you can add applications and libraries). This is great, but is not
sufficient to enable the monorepo-style development.
Nx adds an extra layer of tooling to make this possible.

# Applications

An application contains the minimal amount of code required to package many
libraries together to create an artifact that can be deployed.

The application defines how to build the artifacts that are shipped to the user.
If we have two separate targets, like a promotional website and an admin dashboard,
we might have two separate applications.

# Libraries

A library is a set of files packaged together, consumed but an application.
Libraries are similar to NPM packages/node modules or Nuget packages. They can
be published independently to NPM or bundled with an application as-is.

The purpose of libraries is to split your code into small chunks easier to maintain
and promote code reuse.

# State Management

Managing state is a hard problem. We need to coordinate multiple backends,
web workers, and UI components, all of which update the state concurrently.
NgRx provides a great solution to state management, but implementing it in a
consistent way is left up to developers.

## NgRx

Nx comes with code generators to create recommended implementation patterns
for NgRx. These involve a root state for your application and feature state
for additional modules you add over time to your application.
The code generators handle setting up the files needed to implement state,
complete with actions, reducers and effects along with specs for testing.
These allow your team to follow a set pattern for state management
implementation at the root and feature levels.

## NgRx and Data Persistence

Nx comes with utilities to simplify data persistence with NgRx
(data fetching, optimistic and pessimistic updates). This code provides
implementation patterns that can be repeated for common CRUD operations
with network endpoints.

# Consistency

## Linters

Since Nx provides an opinionated way of developing large Angular applications,
it can safely provide code analysis to help developers ensure they're adhering
to best practices. Nx ships TSLint rules that work with Angular CLI's ng lint
command, and will also provide feedback in IDEs at development time. For example,
if any module imports from a deep path from another library, Nx's linter will
provide feedback that imports should only be imported from the top-level
library name. This helps teams enforce strict public APIs between libraries,
allowing for no surprises when libraries change their internal structure.

## Code Formatter

Developers should spend more time focusing on how code works,
less time on making sure their tabs, whitespace, and line endings are correct.
So Nx provides a formatter to clean up your code in an idiomatic way for you.
Nx's code formatter will run every time something new is generated with
Angular CLI, or can be run manually by running `npm run format` or
`npm run format:check`.
