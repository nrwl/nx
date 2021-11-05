# Using Storybook Composition with Nx

## What is Storybook Compotision

As explained in the [Storybook official docs](https://storybook.js.org/docs/angular/workflows/storybook-composition), Storybook Composition allows you to embed components from any Storybook inside your local Storybook. If you want to learn more about Storybook Composition, please take a look at the following articles, which explain it in detail:

- [Storybook Composition - Chromatic blog](https://www.chromatic.com/blog/storybook-composition/)
- [Storybook Composition - Storybook docs](https://storybook.js.org/docs/angular/workflows/storybook-composition)

## How it works

In essence, you have a Storybook running, which will be the host of the embeded Storybooks as well. Then, you provide this "host" Storybook with a URL of a live/running Storybook. The composed Storybook is then displayed in a new Canvas iframe as part of the host Storybook, and is listed on the left-hand-side stories inventory, too. You can read more about this in the docs listed above.

## How to use it

All you need is a URL of a live Storybook, and a "host" Storybook. In the `.storybook/main.js` file of the "host" Storybook, inside `module.exports` you add a new `refs` attribute, which will contain the link(s) for the composed Storybook(s).

In the example below, we have a host Storybook running on local port 4400 (http://localhost:4400) - not displayed here. In it, we want to compose three other Storybooks. The "one-composed" and "two-composed", running on local ports `4401` and `4402` accordingly, as well as the [Storybook website's Storybook](https://next--storybookjs.netlify.app/official-storybook) which is live on the address that you see.

```
// .storybook/main.js of our Host Storybook - supposably running on port 4400

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

Nx provides the [`run-many`](https://nx.dev/l/a/cli/run-many) command, which will allow you to easily run multiple Storybooks at the same time. You need to run the `run-many`
command with the parallel flag set to true `--parallel=true`, because you want to run all your Storybooks in parallel. Since the default amount of parallel activities that you can run
is set to `3`, you can adjust this command to be of as many Storybooks you want to run in parallel as you need. However, be **very carefull** with putting large numbers in this
flag, since it can cause big delays or get stuck. You can play around and adjust that number to one your machine runs comfortably with. Keep in mind that you can add in this feature however many live/public Storybooks as you need (Storybooks that you do not run locally).

You can just do:

```
nx run-many --target=storybook --projects=main-host,one-composed,two-composed,three-composed --parallel=true --maxParallel=4
```

Before running the above command to actually compose our Storybook instances under the **`main-host`** project, we would need to do the following adjustments to our workspace:

### Adjust the Storybook ports in `project.json`

Take a look in your `project.json` file of each one of your projects (eg. for the `main-host` project, you can find it in the path `apps/main-host/project.json`).
In your project's targets, in the `storybook` target, you will notice that the default port that Nx assigns to your projects' Storybook is always `4400`:

```
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

- When the `nx run-many --target=storybook --parallel=true` command executes, it will go and look into your `project.json` file to see the port you have assigned for that project's Storybook.
- When it finds a port that it is already used, it will change the port number randomly (usually adding `1` until it finds an empty port).

Since we are using the `--parallel=true`, and the commands are executed in parallel, we cannot know for sure the order that the `storybook` command will be executed. So, we cannot be sure which port will correspond to which of the projects.

If we don't change the port numbers, and there are projects that want to use the same port for their Storybooks, the `run-many` command will change that port, and the result will be that we will not know for sure which
of our projects runs on which port. The problem that this creates is that we will not be able to create the proper configuration for Storybook Composition, since we will not be able to tell which URLs our composed Storybooks run on.

### Add the refs in our host project's `.storybook/main.js` file

Now, we need to add to our host project's `main.js` file (the path of which would be `apps/main-host/.storybook/main.js`) a `refs` object, to configure our composition. An example of such a configuration looks like this:

```
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

## Storybook Composition generator

You can use the `@nrwl/storybook:composition` generator to make the above process even easier, so that you do not have to think about ports and settings.

### How to use it

Just execute the following in your terminal, and let the promts guide you:

```
nx generate @nrwl/storybook:composition
```

Read the docs for this command [here]().

### Options

- `mainProject`: It lets you set the "host" project. It's required.

- `projects`: It lets you provide a list of composed projects

- `useExistingPorts`: If false, it will _change_ the Storybook ports in the chosen projects of your project's `project.json` file, and then use these ports in the `mainProject`'s `.storybook/main.js`, to make sure the
  projects correspond to the ports. This is equivalent to the "manual" process described above. If true, the ports will be assigned automatically by the `run-many` command, and the generator will only change your `.storybook/main.js` file, however, if two or more Storybooks are assigned to the same port, you will not be able to use composition successfully. You will have to manually change the ports yourself.

- `all`: It will execute the process for all your projects.

### What this generator does

1. It edits the `mainProject`'s `.storybook/main.js` file, according to the options passed in the command. Each time you run it, it will _overwrite_ your `refs` object inside the `mainProject`'s `.storybook/main.js` file with the new options that you pass.

2. If `useExistingPorts` is **not** set (or set to `false`), it _changes_ the ports for Storybook in the projects that you choose in each of your composed projects `project.json` files.

3. If `useExistingPorts` is **not** set (or set to `false`), it edits your project's `e2e` Cypress base URL, to match the new URL set in each project's `project.json` file.

4. It prompts you with the `storybook-composition` executor command that you can copy and run in your terminal, to run your Storybook composition.

### Easiest way to take advantage of this generator

Chances are you will not care about your project's `project.json` Storybook ports changing. Also, chances are you will not care about your main host project's `.storybook/main.js` `refs` object being overwritten.
So, to try this out quickly, you can do the following:

```
nx g @nrwl/storybook:composition --mainProject=<YOUR_HOST_PROJECT> --all
```

### Who this generator is for

This generator is for the developer who wants to see things working locally, and play around with the Storybook Composition feature, see how it works, explore its capabilities.

### Who this generator is _not_ for

If you are an advanced user and you want to link public projects in your published Storybooks, this generator is _not_ for you. You can use the guide above to manually add your public URLs to your host project's `.storybook/main.js` file(s).

### I already have a Storybook composition setup

If you already have a Storybook composition setup and you want to try this generator, do so, but choose as the `mainProject` another "host" project, and not the one you already have a Composition setup for. The reason is that this generator will
go and overwrite the `refs` object in the main host's project `.storybook/main.js` file.
