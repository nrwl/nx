# Define Code Ownership at the Project Level

The atomic unit of code in an Nx workspace is a project. Tasks, module boundaries and the Nx graph all train us to conceptualize the workspace as a collection of projects. The CODEOWNERS file, however, requires you to switch from a project mental model to a more low-level definition based on the folder structure of your workspace. The `@nx/powerpack-owners` plugin enables you to stay in the mental model that your workspace is a collection of projects as you define the ownership rules for your workspace. Nx will take care of compiling the project ownership rules into file-based ownership rules that GitHub, GitLab or Bitbucket can understand in the CODEOWNERS file.

## Owners Plugin Requires Nx Powerpack

The `@nx/powerpack-owners` plugin requires an Nx Powerpack license to function. [Activating Powerpack](/recipes/installation/activate-powerpack) is a simple process.

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://nx.app/nx-powerpack/purchase" /%}

## Project or File-based Configuration

The ownership configuration is defined in the `nx.json` file or in individual project configuration files. Nx then uses a [sync generator](/concepts/sync-generators) to automatically compile those settings into a valid CODEOWNERS file for GitHub, GitLab or Bitbucket. See the [plugin documentation](/nx-api/powerpack-owners) for more details.

{% cards smCols="2" mdCols="2" lgCols="2" %}

**Define Project Owners**

**Nx Generates the CODEOWNERS file**

```json {% fileName="nx.json" %}
{
  "owners": {
    "format": "github",
    "patterns": [
      {
        "description": "Joe's Rust projects",
        "projects": ["tag:rust"],
        "owners": ["@joelovesrust"]
      },
      {
        "description": "Finance projects",
        "projects": ["finance-*"],
        "owners": ["@finance-team"]
      },
      {
        "description": "Alphabet soup",
        "projects": ["admin", "books", "cart"],
        "owners": ["@alice", "@bob", "@cecil"]
      },
      {
        "description": "CI Workflows",
        "files": [".github/workflows/**/*"],
        "owners": ["@devops"]
      }
    ]
  }
}
```

```yaml {% fileName=".github/CODEOWNERS" %}
# Joe's Rust projects
/packages/rust-api @joelovesrust
/packages/experimental-rust @joelovesrust

# Finance projects
/packages/finance-ui @finance-team
/packages/finance-data @finance-team

# Alphabet soup
/packages/admin @alice @bob @cecil
/packages/books @alice @bob @cecil
/packages/cart @alice @bob @cecil

# CI Workflows
.github/workflows/**/* @devops

/packages/my-project/ @ahmed @petra
/packages/my-project/package.json @ahmed
```

```json {% fileName="packages/my-project/project.json" %}
{
  "owners": {
    "**/*": ["@ahmed", "@petra"],
    "package.json": ["@ahmed"]
  },
};
```

{% /cards %}
