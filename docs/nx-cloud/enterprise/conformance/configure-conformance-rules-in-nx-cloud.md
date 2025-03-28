# Configure Conformance Rules in Nx Cloud

[Nx Cloud Enterprise](/enterprise) allows you to publish your organization's [Nx Conformance](/nx-enterprise/powerpack/conformance) rules to your Nx Cloud Organization, and consume them in any of your other Nx Workspaces without having to deal with the complexity and friction of dealing with a private NPM registry or similar. Authentication is handled automatically through your Nx Cloud connection and rules are downloaded and applied based on your preferences configured in the Nx Cloud UI.

To learn about how to create and publish custom rules to your Nx Cloud Organization, please refer to the [Publish Conformance Rules to Nx Cloud](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud) recipe.

Once you have one or more rules published to your Nx Cloud Organization, you can configure your Nx Cloud Organization to use them in the Nx Cloud UI by visiting:

[https://cloud.nx.app/go/organization/conformance-rules](https://cloud.nx.app/go/organization/conformance-rules)

## Choose the Scope of Configured Rules

The value in the dropdown will determine what workspace(s) the rules will be applied to. By default, "All Workspaces" is the selected value, but you can change this to focus on a specific workspace instead.

## Configure a Rule for the Chosen Workspace Scope

After choosing the target workspace(s), click on the "Configure rule" to open the rule configuration dialog.

Here you will choose which of the rules published to your Nx Cloud Organization should be applied to the chosen workspace(s), and configure any options that the chosen rule supports.

### Rule Options

{% callout title="Rule Options UI" %}
The rule options are currently provided via JSON, but in the near future we will dynamically generate a UI for configuring the options of each rule.
{% /callout %}

The rule options will be validated against the rule's JSON schema definition before being saved, and you will be notified of any validation errors.

### Rule Status

Here you will choose whether or not the rule should be:

- **Enabled**
  - The rule will be executed in the chosen workspace(s) when `nx-cloud conformance` or `nx-cloud conformance:check` is run and any violations will cause the process to fail (exit with a non-zero exit code).
- **Evaluated**
  - The rule will be executed in the chosen workspace(s) when `nx-cloud conformance` or `nx-cloud conformance:check` is run, but any violations will not cause the process to fail (i.e. the process will exit with a zero exit code).
  - This status is useful for exposing violations to allow them to be addressed but without blocking the CI process in the meantime.
  - You can combine this with the [Scheduled Status](#scheduled-status) feature to set a deadline for the chosen workspace(s) to become compliant with the rule.
- **Disabled**
  - The rule will not be executed at all in the chosen workspace(s) and violations will therefore not be reported.

### Scheduled Status

By toggling on the "Schedule configuration", you can choose to set a future date on which the rule should be automatically transitioned to an alternate status.

Most commonly this would be used to transition a rule from **Evaluated** to **Enabled** after a grace period, to allow contributors to address the violations before enforcement begins, but any combination of current and scheduled statuses is supported.

## Notes on the Application of Rules at Runtime

When `nx-cloud conformance` or `nx-cloud conformance:check` are run, any configured rules for the current workspace will be dynamically downloaded from your Nx Cloud Organization and applied to the resolved conformance configuration. This means that the conformance configuration itself is completely optional when using it with Nx Cloud, but it can still be useful if the workspace wants to combine cloud rules with other locally-defined rules.

{% callout title="Organization Rules Override Local Rules" %}
By design, the workspace cannot choose to disable the rules configured in Nx Cloud - any conflict between local and cloud rules will result in the local configuration being overridden by the cloud configuration.
{% /callout %}

If the cloud rules were written to depend on a different version of Nx or Nx Powerpack than is installed within the current workspace, Nx Cloud will handle installing applicable versions dynamically at runtime.
