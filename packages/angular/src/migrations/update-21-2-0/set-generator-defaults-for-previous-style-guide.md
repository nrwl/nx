#### Set Generator Defaults for Previous Style Guide

Updates the generator defaults in the `nx.json` file to maintain the previous Angular Style Guide behavior. This ensures that newly generated code in existing workspaces follows the same conventions as the existing codebase.

#### Examples

The migration will add default configurations for the relevant Angular generators in the workspace's `nx.json` file:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "generators": {}
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "generators": {
    "@nx/angular:component": {
      "type": "component"
    },
    "@nx/angular:directive": {
      "type": "directive"
    },
    "@nx/angular:service": {
      "type": "service"
    },
    "@nx/angular:scam": {
      "type": "component"
    },
    "@nx/angular:scam-directive": {
      "type": "directive"
    },
    "@nx/angular:guard": {
      "typeSeparator": "."
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "."
    },
    "@nx/angular:module": {
      "typeSeparator": "."
    },
    "@nx/angular:pipe": {
      "typeSeparator": "."
    },
    "@nx/angular:resolver": {
      "typeSeparator": "."
    },
    "@schematics/angular:component": {
      "type": "component"
    },
    "@schematics/angular:directive": {
      "type": "directive"
    },
    "@schematics/angular:service": {
      "type": "service"
    },
    "@schematics/angular:guard": {
      "typeSeparator": "."
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "."
    },
    "@schematics/angular:module": {
      "typeSeparator": "."
    },
    "@schematics/angular:pipe": {
      "typeSeparator": "."
    },
    "@schematics/angular:resolver": {
      "typeSeparator": "."
    }
  }
}
```

{% /tab %}
{% /tabs %}

If some of the generator defaults are already set, the migration will not override them:

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" highlightLines=["3-14"] %}
{
  "generators": {
    "@nx/angular:component": {
      "type": "cmp"
    },
    "@schematics/angular:component": {
      "type": "cmp"
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "-"
    }
  }
}
```

{% /tab %}

{% tab label="After" %}

```json {% fileName="nx.json" highlightLines=["3-14"] %}
{
  "generators": {
    "@nx/angular:component": {
      "type": "cmp"
    },
    "@schematics/angular:component": {
      "type": "cmp"
    },
    "@nx/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@schematics/angular:interceptor": {
      "typeSeparator": "-"
    },
    "@nx/angular:directive": {
      "type": "directive"
    },
    "@nx/angular:service": {
      "type": "service"
    },
    "@nx/angular:scam": {
      "type": "component"
    },
    "@nx/angular:scam-directive": {
      "type": "directive"
    },
    "@nx/angular:guard": {
      "typeSeparator": "."
    },
    "@nx/angular:module": {
      "typeSeparator": "."
    },
    "@nx/angular:pipe": {
      "typeSeparator": "."
    },
    "@nx/angular:resolver": {
      "typeSeparator": "."
    },
    "@schematics/angular:directive": {
      "type": "directive"
    },
    "@schematics/angular:service": {
      "type": "service"
    },
    "@schematics/angular:guard": {
      "typeSeparator": "."
    },
    "@schematics/angular:module": {
      "typeSeparator": "."
    },
    "@schematics/angular:pipe": {
      "typeSeparator": "."
    },
    "@schematics/angular:resolver": {
      "typeSeparator": "."
    }
  }
}
```

{% /tab %}
{% /tabs %}
