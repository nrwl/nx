# Core Nx Tutorial - Step 5: Automatically Detect Dependencies

Manually telling Nx about the dependencies between your projects is helpful, but as your repo grows it becomes difficult for a person to keep track of all the dependencies that are introduced. If you miss a dependency, the guarantees of the affected command are voided.

Luckily, Nx core can automatically detect dependencies that are created in `.ts` or `.js` files.

**Side note 1:** If you want to disable detecting dependencies from source code and want to only use the dependencies as defined in `package.json` (the same way yarn does), you can add the following configuration to your `nx.json` file:

```json
{
  "pluginsConfig": {
    "@nrwl/js": {
      "analyzeSourceFiles": false
    }
  }
}
```

**Side note 2:** If you want Nx to automatically detect dependencies for other languages, you can install a plugin for that language. There is a list of Nrwl maintained and third party plugins on the [community page](/community#plugin-directory).

## Create Messages Library

Make two files.

`packages/messages/package.json`:

```json
{
  "name": "messages"
}
```

`packages/messages/index.js`:

```javascript
const message = 'Welcome to the Restaurant at the End of the Universe';

module.exports = { message };
```

This library is exporting a single `message` string.

## Create Cow Application

Install the `cowsay` npm package at the root of the workspace.

```bash
yarn add -W cowsay@1.5.0
```

Make an application that uses the `messages` library. Note that you won't specify the dependency manually in the `package.json` file.

`packages/cow/package.json`:

```json
{
  "name": "cow",
  "version": "0.0.1",
  "scripts": {
    "serve": "node index.js"
  }
}
```

`packages/cow/index.js`:

```javascript
var cowsay = require('cowsay');
var { message } = require('../messages');

console.log(
  cowsay.say({
    text: message,
  })
);
```

Now if you run `nx serve cow`, you'll see this:

```bash
$ node index.js
 ______________________________________________________
< Welcome to the Restaurant at the End of the Universe >
 ------------------------------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
Done in 0.14s.

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target serve for project cow


   See Nx Cloud run details at https://nx.app/runs/nZBYYBEuIfG
```

## View the Project Graph

Run `nx graph` to view the new project graph. You'll see a dependency line has been drawn between `cow` and `messages` because Nx recognises that `cow` is referencing code inside the `messages` project.

This line tells Nx about the dependency:

```javascript
var { message } = require('../messages');
```

If at some point in the future the code is refactored so that cow no longer references messages, the project graph will automatically update accordingly.

## More Tooling

If you want Nx to do more for you, you can install the `@nrwl/js` plugin to help with typescript or javascript tooling. This plugin provides out of the box:

- Typescript alias paths
- Build with `tsc` or `swc`
- Jest and ESLint configuration

## What's Next

- Continue to [Step 6: Summary](/core-tutorial/06-summary)
