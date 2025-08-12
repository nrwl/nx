# Instructions for editing markdoc files

Update the markdoc files in the provided directory to use our new syntax correctly. do not forget any steps and be methodical. and most importantly accurate in your changes.

## code fences

for files that contain code blocks/code fences make the following changes

move usage of `%{ fileName="<file-name>" %}`
to be on a new line under the ```values with a`// <file-name>` value
i.e. if the codeblock already has a // <file-name> you can skip the code block

```<lang>
// <file-name
```

when seeing `%{ highlightLines="<value>" %}` change this value to `%{meta="{<values>}"` instead.
and wrap the values in `"` if they aren't already and use `{<syntax>}` syntax

i.e.
`{% highlightLines=["1-3"] %}`
to be the value `{% meta="{1-3}"` if the item has a fileName as well and when moved down as a `// fileName` you'll need to increment the existing line counts by 1
it's possible there are already `meta` usage and if that's the case you can skip the code block

When you see a `shell` language add to it to the `{% frame="none" %}` value as well
i.e.
old

```shell
.. some content
```

new

```shell {% frame="none" %}
.. some content
```

```

```

When you see a `{% command="<some-command>" %}`
switch it to `{% title="<some-command>" frame="terminal" %}`
you can remove any references to `path=""` property as well
i.e.
old

```{% command="npm install" %}
.. content ...
```

new

```{% title="npm install" frame="terminal"%}
.. content ..
```

## tab

tabs markdoc component should use the following syntax

```
{% tabs %}
{% tabitem label="<tab-label>" %}
{%/ tabitem %}
{% /tabs %}
```

if you see the `{%tab label=""<tab-value>" %}`, switch it to use a tabitem, `{% tabitem label="<tab-label>" %}`

### callouts

move `callout` to `aside`
asides have a type value of 'note' | 'tip' | 'caution' | 'danger'
if the callout didn't use one of those values, then switch the type to correctly use one of the closes matching values.

## headings

if the file has an initial h1 heading `# <heading>` value after the frontmatter, remove the entire heading line since it's not needed anymore

## existing markdoc tags

if the tag has a `-` in the tag name, they'll need to move to `_`
i.e.
old

```mdoc
{% github-repository ... /%}
```

new

```mdoc
{% github_repository ... /%}
```

it's important to be systematic and careful when doing this work. go file by file and change each of the list items from above in the file first before moving on. remember to think hard about the changes and what needs to be moved. it's common that there will be a mix of most of all of the listed items that must be done. remember some of the files might already be correctly parsed.
