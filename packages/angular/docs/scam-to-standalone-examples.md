## Examples

{% tabs %}

{% tab label="Basic Usage" %}

This generator allows you to convert an Inline SCAM to a Standalone Component. It's important that the SCAM you wish to convert has it's NgModule within the same file for the generator to be able to correctly convert the component to Standalone.

```bash

nx g @nx/angular:scam-to-standalone --component=libs/mylib/src/lib/myscam/myscam.component.ts --project=mylib

```

{% /tab %}

{% /tabs %}
