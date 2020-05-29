_[Please make sure you have read the submission guidelines before posting an PR](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr)_

# Community Plugin Submission

Thanks for submitting your Nx Plugin to our community plugins list. Make sure to follow these steps to ensure that your PR is approved in a timely manner.

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

Once merged, your will plugin will be available when running the `nx list` command, and will also be available in the Plugin browser on [nx.dev](https://nx.dev)
