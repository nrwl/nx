# Setting up Storybook Composition with Nx

## What is Storybook Compotision

As explained in the [Storybook official docs](https://storybook.js.org/docs/angular/workflows/storybook-composition), Storybook Composition allows you to embed components from any Storybook inside your local Storybook. If you want to learn more about Storybook Composition, please take a look at the following articles, which explain it in detail:

- [Storybook Composition - Chromatic blog](https://www.chromatic.com/blog/storybook-composition/)
- [Storybook Composition - Storybook docs](https://storybook.js.org/docs/angular/workflows/storybook-composition)

## How it works

In essence, you have a Storybook running, which will be the host of the embeded Storybooks as well. Then, you provide this "host" Storybook with a URL of a live/running Storybook. The composed Storybook is then displayed in a new Canvas iframe as part of the host Storybook, and is listed on the left-hand-side stories inventory, too. You can read more about this in the docs listed above.

## How to use it

All you need is a URL of a live Storybook, and a "host" Storybook. In the `.storybook/main.js` file of the "host" Storybook, inside `module.exports` you add a new `refs` attribute, which will contain the link(s) for the composed Storybook(s).

In the example below, we have a host Storybook running on local port 4400 (http://localhost:4400) - not displayed here. In it, we want to compose three other Storybooks. The "one-composed" and "two-composed", running on local ports `4401` and `4402` accordingly, as well as the [Storybook website's Storybook](https://next--storybookjs.netlify.app/official-storybook) which is live on the address that you see.

```javascript
// .storybook/main.js of our Host Storybook - assuming it's running on port 4400
module.exports = {
  ...,
  refs: {
    'one-composed': {
      title: 'One composed',
      url: 'http://localhost:4401',
    },
    'two-composed': {
      title: 'Two composed',
      url: 'http://localhost:4402',
    },
    'storybook-website-storybook': {
      title: 'The Storybook of the Storybook website',
      url: 'https://next--storybookjs.netlify.app/official-storybook/',
    },
  },
};
```

You can always read more in the [official Storybook docs](https://storybook.js.org/docs/angular/workflows/storybook-composition#compose-published-storybooks).

## How to use it in Nx

It's quite easy to use this feature, in Nx and in general, since you do not need to make any code changes, you just need to have the "composed" Storybook instances (the ones you need to "compose") running, choose a "host" Storybook, and just add the composed Storybooks in it's `.storybook/main.js` file.

Nx provides the [`run-many`](https://nx.dev/l/a/cli/run-many) command, which will allow you to easily run multiple Storybooks at the same time. You need to run the `run-many` command with the parallel flag (eg. `--parallel=4`), because you want to run all your Storybooks in parallel. You can change the value of the `parallel` flag to be of as many Storybooks you want to run in parallel as you need. However, be **very carefull** with putting large numbers in this
flag, since it can cause big delays or get stuck. You can play around and adjust that number to one your machine runs comfortably with. Keep in mind that you can add in this feature however many live/public Storybooks as you need (Storybooks that you do not run locally).

You can just do:

```bash
nx run-many --target=storybook --projects=main-host,one-composed,two-composed,three-composed --parallel=4
```

Before running the above command to actually compose our Storybook instances under the **`main-host`** project, we would need to do the following adjustments to our workspace:

### Adjust the Storybook ports in `project.json`

Take a look in your `project.json` file of each one of your projects (eg. for the `main-host` project, you can find it in the path `apps/main-host/project.json`).
In your project's targets, in the `storybook` target, you will notice that the default port that Nx assigns to your projects' Storybook is always `4400`:

```json
{
  ...
  "targets": {
    ...
    "storybook": {
      ...
      "options": {
        ...
        "port": 4400,
        ...
      },
      ...
    },
    ...
`  },
}
```

We can keep this port for the project which will serve as the host of our configuration, but we must change the port numbers of the other projects, the projects which will be composed/composed. The reason for that is the following:

- When the `nx run-many --target=storybook --parallel=4` command executes, it will go and look into your `project.json` file to see the port you have assigned for that project's Storybook.
- When it finds a port that it is already used, it will change the port number randomly (usually adding `1` until it finds an empty port).

Since we are using the `--parallel` flag, and the commands are executed in parallel, we cannot know for sure the order that the `storybook` command will be executed. So, we cannot be sure which port will correspond to which of the projects.

If we don't change the port numbers, and there are projects that want to use the same port for their Storybooks, the `run-many` command will change that port, and the result will be that we will not know for sure which
of our projects runs on which port. The problem that this creates is that we will not be able to create the proper configuration for Storybook Composition, since we will not be able to tell which URLs our composed Storybooks run on.

### Add the refs in our host project's `.storybook/main.js` file

Now, we need to add to our host project's `main.js` file (the path of which would be `apps/main-host/.storybook/main.js`) a `refs` object, to configure our composition. An example of such a configuration looks like this:

```javascript
module.exports = {
  ...,
  refs: {
    one-composed: {
      title: 'One composed',
      url: 'http://localhost:4401',
    },
    two-composed: {
      title: 'Two composed',
      url: 'http://localhost:4402',
    },
    three-composed: {
      title: 'Three composed',
      url: 'http://localhost:4403',
    },
  },
};
```
