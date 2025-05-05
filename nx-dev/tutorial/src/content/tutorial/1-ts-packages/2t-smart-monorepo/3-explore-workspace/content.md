---
type: lesson
title: Explore Your Workspace
focus: /nx.json
previews:
  - { port: 4211, title: 'Nx Graph', pathname: 'projects/%40tuskdesign%2Fzoo' }
---

### Explore Your Workspace

<!-- {% video-link link="https://youtu.be/ZA9K4iT3ANc?t=250" /%} -->

If you run `nx graph` as instructed, you'll see the dependencies between your projects.

```shell {% path="~/tuskydesigns" %}
nx graph --focus=@tuskdesign/zoo
```

Nx uses this graph to determine the order tasks are run and enforce module boundaries. You can also leverage this graph to gain an accurate understanding of the architecture of your codebase. Part of what makes this graph invaluable is that it is derived directly from your codebase, so it will never become out of date.
