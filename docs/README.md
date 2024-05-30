# Documentation

## Structure of the Documentation

When writing documentation, it is important to know the audience you are writing for and what kind of document you are writing. We try to follow the framework listed below, but there are always some exceptions since the documentation is always changing. This framework is valuable to keep in mind, but we also follow the principle that if a PR is better than the existing content on the site, we'll merge it in and follow up to make it better later if it doesn't perfectly match the standards.

### Types of Documents

We are generally following the [Diataxis](https://diataxis.fr) model where documents are divided into tutorials, concept guides, recipes and reference.

- Tutorial - Focused on explaining a concept through step by step instructions.
- Concept guide - Explains why something works the way it does or how to think about something.
- Recipe - Focused directions to accomplish a specific task. Describes how to do something.
- Reference - Lists what you can do with the tool (i.e. API docs).

### Audiences

We also have different audiences in mind when writing docs:

👶 New user starting from scratch

- They know their framework of choice
- They have probably heard the term monorepo but don't really know what it is
- They're smart and eager to learn

👶 New user migrating an existing repo

- They know their framework of choice
- They know how npm workspaces work
- They're smart and eager to learn

👦 Intermediate User

- They know how to create an Nx repo or add Nx to an existing repo
- They have heard the terms integrated and package-based
- They know what a project is and how to make one
- They understand how to run a task and the basics of caching
- They can launch the graph
- They know that it is possible to enforce project boundaries

👨‍🦳 Advanced User

- They know everything about Nx except the specific piece of knowledge that is being taught by this document.

### Outline

- Getting Started - These documents assume a new user and are generally concept guides with a lot of links to other parts of the site. There are some elements of recipes mixed in, but those should be kept to a minimum.
- Tutorials - These are tutorials written for a new user. After completing one of these tutorials, the user should have enough knowledge to be an intermediate user.
- Core Features - These are primarily recipes with a little concept mixed in. These documents should be short and provide the basic information that people will want 80% of the time and link to anything more complex. A new user should be able to click through these documents and skim them to get a good understanding of what Nx does without getting overwhelmed with details.
- Concepts - These are concept guides written for a new user. Any recipe content should be split into a recipe document and linked.
- More Concepts (or other categories under Concepts) - These are concept guides written for an intermediate user.
- Recipes - These are recipes written for an advanced user.
- Nx with Your Favorite Tech - These are tutorials written for an intermediate user.
- Benchmarks - Reference documents linking to external resources.
- Reference - Reference documents.

## Markdown syntax available

The default markdown syntax is supported when writing documentation.

### Front matter

Front matter is used to add metadata to your Markdown file (`title` & `description`). It is provided at the very top of the file, enclosed by three dashes `---`. The content is parsed as `YAML`.

If no Front matter is detected, the metadata will be populated with the following:

- `title`: first main title detected
- `description`: first paragraph detected

```markdown
---
title: This is a custom title
description: This is a custom description
---
```

### Social Media Images

You can specify a custom social media image for a page by specifying `mediaImage` in the `map.json` entry for that page. `mediaImage` is a path relative to `/docs`.

Note that you won't see the social media image in the preview generated for your PR, because it loads from the live `nx.dev` site. You can make sure the image is correct by looking at `[preview-url]/images/open-graph/[page-url].[image-extension]`.

### Custom markdown syntax

The documentation website [nx.dev](https://nx.dev) is using custom Markdown syntax to enable the authors to add functionality to its content.

#### Callouts

Callouts are available to get the attention of the reader on some specific type of information.

```markdown
{% callout type="caution|check|note|warning" title="string" %}
Your content goes here.
{% /callout %}
```

#### Disclosure

A disclosure can be used for less important information that is initially collapsed.

```markdown
{% disclosure title="string" %}
Your content goes here.
{% /disclosure %}
```

#### Cards

Cards allow showing content in a grid system with a title, a description, a type and an url (internal/external).

```markdown
{% cards %}
{% card title="string" description="string" type="documentation|external|video" url="string" /%}
{% card title="string" description="string" type="documentation|external|video" url="string" /%}
// as many as cards you want
{% /cards %}
```

Title cards allow to only show a title in a card with a title and an url.

```markdown
{% cards cols="4" %}
{% title-card title="string" url="string" /%}
{% title-card title="string" url="string" /%}
{% title-card title="string" url="string" /%}
{% title-card title="string" url="string" /%}
{% /cards %}
```

#### Code

You can add specific languages and a filename on the code snippet displayed.

````
‎```javascript {% fileName="main.js" %}
‎ const code = "goes here";
‎```
````

#### Line Highlighting

You can define groups of lines that can be interactively highlighted to illustrate a point.

````
‎```javascript {% lineGroups={ first:[2,3],second:[4,5] } %}
‎ const code = "goes here";
‎ This is in the first group
‎ This is also in the first group
‎ This is in the second group
‎ This is also in the second group
‎```
````

The line groups can be highlighted using a button on the code fence itself, or by clicking on a link that you provide that changes the url fragment.

For example:

```
[This will highlight the first group.](#first)
```

You can also statically highlight a set of lines (the user won't be able to change what is highlighted):

````
‎```javascript {% highlightLines=[2,3] %}
‎ const code = "goes here";
‎ This is highlighted
‎ This is also highlighted
‎ This is not highlighted
‎ Neither is this
‎```
````

You can also specify ranges like `highlightLines=[2,3,"8-10"]`.

#### Terminal command

To display a terminal command, use:

````
‎```shell
‎ npx nx build
‎```
````

#### Terminal Output

You can display your terminal output with a dedicated component the same way you would show code.

````
‎``` {% command="node index.js" %}
‎ My terminal output here!
‎```
````

You can optionally also pass a `path` like

````
‎``` {% command="node index.js" path="~/myorg" %}
‎ My terminal output here!
‎```
````

#### Terminal Video Output

You can have a more dynamic visualization of a terminal output by using the following component:

```
{% terminal-video src="/documentation/shared/images/caching/cache-terminal-animation.mp4" /%}
```

#### Custom iframes

We can display a special iframe and setting its width inside the document.

```markdown
{% iframe
src="https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438?hideHeader=true"
title="Nx Cloud dashboard"
width="100%" /%}
```

If the type of the card is set to `type="video"` the `url` is a valid YouTube url, then the card will show a thumbnail of the video.

#### GitHub repositories

We can display a special button inviting the reader to go to a GitHub repository.

```markdown
{% github-repository url="https://github.com/nrwl/nx-examples" /%}
```

#### Stackblitz Buttons

You can add an "open in stackblitz" button as follows:

```markdown
{% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/angular-standalone?file=README.md" /%}
```

#### Install Nx Console

We can display a special button inviting the reader to go to a VSCode marketplace to install the official Nx plugin.

```markdown
{% install-nx-console /%}
```

#### Side by side

You can show content in a grid of 2 columns, via the `side-by-side` shortcode.

```markdown
{% side-by-side %}
You first content is here.

You second content is over here. _Note the space in between._
{% /side-by-side %}
```

#### Tabs

You can display multiple related information via a tabbing system.

```markdown
{% tabs %}
{% tab label="npm" %}
NPM related information.
{% /tab %}
{% tab label="yarn" %}
Yarn related information.
{% /tab %}
{% /tabs %}
```

##### Youtube

Embed a YouTube video directly with the following shortcode, control the title and the associated width. `src` can be the Youtube URL from the browser, the "share" button (short YT url) or the embed URL.

```markdown
{% youtube
src="https://www.youtube.com/embed/rNImFxo9gYs"
title="Nx Console Run UI Form"
width="100%" /%}
```

#### Youtube Section Link

Have a more decent button-like widget that you can place below sections of a tutorial with a link to a specific point in a Youtube video.

```markdown
{% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=64" /%}
```

#### Project Details View

Embed a Project Details View that is identical what is shown in Nx Console or `nx show project myproject --web`

````markdown
{% project-details title="Test" height="100px" %}

```json
{
  "project": {
    "name": "demo",
    "data": {
      "root": " packages/demo",
      "projectType": "application",
      "targets": {
        "dev": {
          "executor": "nx:run-commands",
          "options": {
            "command": "vite dev"
          }
        },
        "build": {
          "executor": "nx:run-commands",
          "inputs": ["production", "^production"],
          "outputs": ["{projectRoot}/dist"],
          "options": {
            "command": "vite build"
          }
        }
      }
    }
  },
  "sourceMap": {
    "targets": ["packages/demo/vite.config.ts", "@nx/vite"],
    "targets.dev": ["packages/demo/vite.config.ts", "@nx/vite"],
    "targets.build": ["packages/demo/vite.config.ts", "@nx/vite"]
  }
}
```

{% /project-details %}
````

#### Graph

Embed an Nx Graph visualization that can be panned by the user.

````markdown
{% graph height="450px" %}

```json
{
  "projects": [
    {
      "type": "app",
      "name": "app-changed",
      "data": {
        "tags": ["scope:cart"]
      }
    },
    {
      "type": "lib",
      "name": "lib",
      "data": {
        "tags": ["scope:cart"]
      }
    },
    {
      "type": "lib",
      "name": "lib2",
      "data": {
        "tags": ["scope:cart"]
      }
    },
    {
      "type": "lib",
      "name": "lib3",
      "data": {
        "tags": ["scope:cart"]
      }
    }
  ],
  "groupByFolder": false,
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "dependencies": {
    "app-changed": [
      {
        "target": "lib",
        "source": "app-changed",
        "type": "direct"
      }
    ],
    "lib": [
      {
        "target": "lib2",
        "source": "lib",
        "type": "implicit"
      },
      {
        "target": "lib3",
        "source": "lib",
        "type": "direct"
      }
    ],
    "lib2": [],
    "lib3": []
  },
  "affectedProjectIds": []
}
```

{% /graph %}
````

## Publishing Process

There are multiple versions of the `nx.dev` site.

- [canary.nx.dev](https://canary.nx.dev) contains the documentation on the `master` branch
- [nx.dev](https://nx.dev) contains the documentation as of the latest release of Nx to npm. The main site will not include reference documentation for APIs that have been merged to the codebase, but not yet released to the public.
- `[version].nx.dev` contains the documentation for that version of Nx. `[version]` in this case is the major version up to the current LTS version of Nx. So [18.nx.dev](https://18.nx.dev) will show the Nx documentation as of the last released version of Nx 18.

When a commit that contains documentation is merged into `master`, it will be immediately published to `canary.nx.dev`. Whenever a new release of Nx is published to npm, that documentation will then be available on the main site.

### Immediately Publishing Time-Sensitive Documentation

If you have a documentation change that should be published immediately, you'll need to create 2 PRs.

1. First, create a PR against `master` in the normal manner.
2. Your second PR needs to be made against the website branch with the latest major version of Nx. So your second PR can be created against `website-19` if the latest version of Nx is `19.1.0`. Once `website-19` is updated with your changes, the main `nx.dev` site will be updated.

Later, when Nx `19.1.1` is released, `website-19` will be overwritten with whatever is on `master` and the first PR you created will take effect.
