# <%= name %>

This library was generated with [Nx](https://nx.dev).

<% if (buildable) { %>

## Building

Run `<%= cliCommand %> build <%= name %>` to build the library.

<% } %>

<% if (hasUnitTestRunner) { %>

## Running unit tests

Run `<%= cliCommand %> test <%= name %>` to execute the unit tests via [Jest](https://jestjs.io).

<% } %>
