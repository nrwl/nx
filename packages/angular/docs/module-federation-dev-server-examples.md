## Examples

{% tabs %}

{% tab label="Basic Usage" %}
The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve them statically also.  
See an example set up of it below:

```json
{
  "serve": {
    "executor": "@nx/angular:module-federation-dev-server",
    "configurations": {
      "production": {
        "browserTarget": "host:build:production"
      },
      "development": {
        "browserTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200"
    }
  }
}
```

{% /tab %}

{% tab label="Serve host with remotes that can be live reloaded" %}
The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve a set selection with live reloading enabled also.  
See an example set up of it below:

```json
{
  "serve-with-hmr-remotes": {
    "executor": "@nx/angular:module-federation-dev-server",
    "configurations": {
      "production": {
        "browserTarget": "host:build:production"
      },
      "development": {
        "browserTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200",
      "devRemotes": ["remote1", "remote2"]
    }
  }
}
```

{% /tab %}

{% /tabs %}
