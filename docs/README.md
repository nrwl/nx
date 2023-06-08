# Documentation

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

### Custom markdown syntax

The documentation website [nx.dev](https://nx.dev) is using custom Markdown syntax to enable the authors to add functionality to its content.

#### Callouts

Callouts are available to get the attention of the reader on some specific type of information.

```markdown
{% callout type="caution|check|note|warning" title="string" %}
Your content goes here.
{% /callout %}
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
{% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/standalone-angular-app?file=README.md" /%}
```

#### Install Nx Console

We can display a special button inviting the reader to go to a VSCode marketplace to install the official Nx plugin.

```markdown
{% install-nx-console /%}
```

#### Nx Cloud section

We can display Nx Cloud related content in the documentation with a visual cue.

```markdown
{% nx-cloud-section %}
Your content goes here.
{% /nx-cloud-section %}
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

Embed a YouTube video directly with the following shortcode, control the title and the associated width.

```markdown
{% youtube
src="https://www.youtube.com/embed/rNImFxo9gYs"
title="Nx Console Run UI Form"
width="100%" /%}
```

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
