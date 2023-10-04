<!-- 
_[Please make sure you have read the submission guidelines before posting an PR](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr)_

# Community Plugin Submission

Thanks for submitting your Nx Plugin to our community plugins list. Make sure to follow these steps to ensure that your PR is approved in a timely manner.

## Plugin Requirements

Before you submit your plugin to be listed in our registry, it needs to meet the following requirements:
- Run some kind of automated e2e tests in your repository
- Include `@nx/devkit` as a `dependency` in the plugin's `package.json`
- List a `repository.url` in the plugin's `package.json`

i.e.

```
{
  "repository": {
    "type": "git",
    "url": "https://github.com/nrwl/nx.git",
    "directory": "packages/web"
  }
}
```

Note: We reserve the right to remove unmaintained plugins from the registry.  If the plugins become maintained again, they can be resubmitted to the registry.

## Steps to Submit Your Plugin
- Use the following commit message template: `chore(core): nx plugin submission [PLUGIN_NAME]`
- Update the `community/approved-plugins.json` file with a new entry for your plugin that includes `name`, `url`, `description`:

Example:

```json
// community/approved-plugins.json

[{
    "name": "@community/plugin",
    "url": "https://github.com/community/plugin",
    "description": "This plugin provides the following capabilities."
}]
```

Once merged, your plugin will be available when running the `nx list` command, and will also be available in the Plugin Registry on [nx.dev](https://nx.dev/plugin-registry)
-->

# Community Plugin Submission

## {replace with plugin's name}

<!-- 
Describe what your plugin is and what is its goal or issues it addresses.  If you don't provide a description, we will not merge your PR.
Is it focused on a technology, tooling or behaviour? Does the plugin provide generators, executors or graph support?
Do you know who is already using the plugin? Mention who is the author of the plugin.
-->
