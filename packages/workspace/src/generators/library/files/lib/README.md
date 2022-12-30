# <%= name %>

This library was generated with [Nx](https://nx.dev).
<% if (hasUnitTestRunner) { %>

## Running unit tests

Run `<%= cliCommand %> test <%= name %>` to execute the unit tests via [Jest](https://jestjs.io).
<% } %><% if (hasLinter) { %>

## Running lint

Run `<%= cliCommand %> lint <%= name %>` to execute the lint via [ESLint](https://eslint.org/).
<% } %>
