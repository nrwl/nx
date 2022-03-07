# Core Nx Tutorial - Step 3: Share Assets

You probably noticed that you're using the same friendly cow ASCII art in the blog and CLI. Since both projects are in the same repo, it would be good to share that asset across both projects.

## Create an Asset Library

You can make a library project just for holding the ASCII asset files. Let Nx know about the project by creating a `project.json` file like this:

`packages/ascii/project.json`:

```json
{
  "root": "packages/ascii",
  "sourceRoot": "packages/ascii/assets",
  "projectType": "library"
}
```

Note: You could choose to make a `package.json` file here instead, if you prefer.

Then move `cow.txt` out of the `cli` project to:

`packages/ascii/assets/cow.txt`:

```bash
 _____
< moo >
 -----
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

## Use the Shared Assets Library in the Blog

In the eleventy blog, you need to add some configuration so that Eleventy knows how to read `.txt` files.

`packages/blog/.eleventy.js`:

```javascript
const { EleventyRenderPlugin } = require('@11ty/eleventy');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyRenderPlugin);
  eleventyConfig.extensionMap = [
    {
      key: 'txt',
      extension: 'txt',
      compile: function compile(str, inputPath, preTemplateEngine, bypass) {
        return function render(data) {
          return str;
        };
      },
    },
  ];
};
```

Then you can reference that shared asset file in a blog post.

`packages/blog/src/posts/ascii.md`:

```markdown
---
pageTitle: Some ASCII Art
---

Welcome to [The Restaurant at the End of the Universe](https://hitchhikers.fandom.com/wiki/Ameglian_Major_Cow)

<pre>
{% renderFile "../ascii/assets/cow.txt" %}
</pre>

Art courtesy of [cowsay](https://www.npmjs.com/package/cowsay).
```

## Use the Shared Assets Library in the CLI

For the Go CLI, you only need to update the Go code.

`packages/cli/src/ascii.go`:

```go
package main

import (
  "fmt"
  "os"
)

func check(e error) {
  if e != nil {
      panic(e)
  }
}

func main() {
    fmt.Println("Hello, World!")
    dat, err := os.ReadFile("../ascii/assets/cow.txt")
    check(err)
    fmt.Print(string(dat))
}
```

## Tell Nx About the Dependencies

Nx without plugins is unable to automatically detect dependencies in Go code or markdown, so you'll have to tell Nx about the dependencies manually.

For the blog project, you'll need to add `ascii` as a `dependency` (or `devDependency`) in the `package.json` file.

`packages/blog/package.json`:

```json
{
  "name": "blog",
  "description": "eleventy blog",
  "version": "1.0.0",
  "dependency": {
    "ascii": "*"
  },
  "scripts": {
    "build": "eleventy --input=./src --output=../../dist/packages/blog",
    "serve": "eleventy --serve --input=./src --output=../../dist/packages/blog"
  }
}
```

For the cli project, you add the implicit dependencies in the `project.json` file.

`packages/cli/project.json`:

```json
{
  "root": "packages/cli",
  "sourceRoot": "packages/cli/src",
  "projectType": "application",
  "implicitDependencies": ["ascii"],
  "targets": {
    "build": {
      "executor": "@nrwl/workspace:run-commands",
      "options": {
        "command": "go build -o='../../dist/packages/cli/' ./src/ascii.go",
        "cwd": "packages/cli"
      }
    },
    "serve": {
      "executor": "@nrwl/workspace:run-commands",
      "options": {
        "command": "go run ./src/ascii.go",
        "cwd": "packages/cli"
      }
    }
  }
}
```

## Test the Changes

You should now be able to run

```bash
nx serve blog
```

and

```bash
nx serve cli
```

and get the same results as before.

## View the Project Graph

You can view a visual representation of the project graph by running:

```bash
nx graph
```

When the graph opens in your browser, click the `Show all projects` button in the left sidebar. You should see dependency lines drawn from `blog` and `cli` to `ascii`.
