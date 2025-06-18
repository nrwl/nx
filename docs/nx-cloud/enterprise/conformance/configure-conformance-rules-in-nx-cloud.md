# Configure Conformance Rules in Nx Cloud

[Nx Cloud Enterprise](/enterprise) allows you to publish your organization's [Nx Conformance](/nx-enterprise/powerpack/conformance) rules to your Nx Cloud Organization, and consume them in any of your other Nx Workspaces without having to deal with the complexity and friction of dealing with a private NPM registry or similar. Authentication is handled automatically through your Nx Cloud connection and rules are downloaded and applied based on your preferences configured in the Nx Cloud UI.

To learn about how to create and publish custom rules to your Nx Cloud Organization, please refer to the [Publish Conformance Rules to Nx Cloud](/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud) recipe.

Once you have one or more rules published to your Nx Cloud Organization, you can configure your Nx Cloud Organization to use them in the Nx Cloud UI by visiting:

[https://cloud.nx.app/go/organization/conformance-rules](https://cloud.nx.app/go/organization/conformance-rules)

![Nx Cloud Conformance Rules Dashboard](/docs/nx-cloud/enterprise/conformance/screenshots/conformance-rules-dashboard.png)

## Understanding the Conformance Rules Dashboard

The conformance rules dashboard provides comprehensive visibility into your organization's rule adoption and compliance across all workspaces. The interface is designed with two main views to help platform and engineering leaders track and manage conformance standards effectively.

### Rule Overview

The **Rule Overview** screen provides a summary of all conformance rules that have been applied across your organization's workspaces. This view displays:

- The current status of each rule (such as "evaluate" or "enforced")
- Which workspaces the rule is active in
- Any violations detected across your repositories
- Overall compliance metrics at a glance

![Rule Overview Table](/docs/nx-cloud/enterprise/conformance/screenshots/rule-overview-table.png)

This overview enables you to quickly track adoption and compliance with organizational standards across both Nx and non-Nx repositories.

### Rule Metadata Overview

The **Rule Metadata Overview** screen gives you a detailed dive into the technical and organizational metadata attached to each rule. This comprehensive view includes:

- Information about the rule's purpose and description
- History of changes and rule evolution
- Current evaluation mode and enforcement status
- Enforcement schedule and timeline information
- Detailed breakdown of which specific workspaces or repositories are in or out of compliance
- Audit trail and rule lifecycle management details

![Rule Metadata Overview](/docs/nx-cloud/enterprise/conformance/screenshots/rule-metadata-overview.png)

This detailed view supports thorough auditing and makes it easier to manage the lifecycle of rules across a large set of codebases. Both screens are designed to streamline governance and visibility, allowing you to evaluate rollout effectiveness and adoption patterns across your entire organization.

## Choose the Scope of Configured Rules

The value in the dropdown will determine what workspace(s) the rules will be applied to. By default, "All Workspaces" is the selected value, but you can change this to focus on a specific workspace instead.

![Workspace Scope Dropdown Selection](/docs/nx-cloud/enterprise/conformance/screenshots/workspace-scope-dropdown.png)

## Configure a Rule for the Chosen Workspace Scope

After choosing the target workspace(s), click on the "Configure rule" to open the rule configuration dialog.

![Configure Rule Button](/docs/nx-cloud/enterprise/conformance/screenshots/configure-rule-button.png)

Here you will choose which of the rules published to your Nx Cloud Organization should be applied to the chosen workspace(s), and configure any options that the chosen rule supports.

![Rule Configuration Dialog](/docs/nx-cloud/enterprise/conformance/screenshots/rule-configuration-dialog.png)

### Rule Options

{% callout title="Rule Options UI" %}
The rule options are currently provided via JSON, but in the near future we will dynamically generate a UI for configuring the options of each rule.
{% /callout %}

![Rule Options JSON Configuration](/docs/nx-cloud/enterprise/conformance/screenshots/rule-options-json.png)

The rule options will be validated against the rule's JSON schema definition before being saved, and you will be notified of any validation errors.

![Rule Options Validation Error](/docs/nx-cloud/enterprise/conformance/screenshots/rule-options-validation-error.png)

### Rule Status

Here you will choose whether or not the rule should be:

![Rule Status Selection](/docs/nx-cloud/enterprise/conformance/screenshots/rule-status-selection.png)

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

![Scheduled Status Configuration](/docs/nx-cloud/enterprise/conformance/screenshots/scheduled-status-configuration.png)

Most commonly this would be used to transition a rule from **Evaluated** to **Enabled** after a grace period, to allow contributors to address the violations before enforcement begins, but any combination of current and scheduled statuses is supported.

## Notes on the Application of Rules at Runtime

When `nx-cloud conformance` or `nx-cloud conformance:check` are run, any configured rules for the current workspace will be dynamically downloaded from your Nx Cloud Organization and applied to the resolved conformance configuration. This means that the conformance configuration itself is completely optional when using it with Nx Cloud, but it can still be useful if the workspace wants to combine cloud rules with other locally-defined rules.

{% callout title="Organization Rules Override Local Rules" %}
By design, the workspace cannot choose to disable the rules configured in Nx Cloud - any conflict between local and cloud rules will result in the local configuration being overridden by the cloud configuration.
{% /callout %}

If the cloud rules were written to depend on a different version of Nx or Nx Powerpack than is installed within the current workspace, Nx Cloud will handle installing applicable versions dynamically at runtime.
