{% tabs %}
{% tab label="Create rule" %}

This command will generate a new workspace lint rule called `my-custom-rule`. The new rule will be generated in `tools/eslint-rules/rules` folder:

```shell
nx g @nx/linter:workspace-rule my-custom-rule
```

{% /tab %}
{% tab label="Custom sub-folder" %}

We can change the default sub-folder from `rules` and specify a custom one:

```shell
nx g @nx/linter:workspace-rule --name=my-custom-rule --directory=my/custom/path
```

The command above will generate the rule in `tools/eslint-rules/my/custom/path` folder.

{% /tab %}
{% /tabs %}

---
