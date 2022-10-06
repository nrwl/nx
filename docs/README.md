# Documentation

## Markdown syntax available

The documentation website [nx.dev](https://nx.dev) is using custom Markdown syntax to enable the authors to add functionality to its content.

#### Callouts

Callouts are available to get the attention of the reader on some specific type of information.

```markdown
{% callout type="caution|check|note|warning" title="string" %}
Your content goes here.
{% /callout %}
```

#### Cards

Cards allow to show content in a grid system with a title, a description, a type and an url (internal/external).

```markdown
{% cards %}
{% card title="string" description="string" type="documentation|external|video" url="string" %}
{% card title="string" description="string" type="documentation|external|video" url="string" %}
// as many as cards you want
{% /cards %}
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
