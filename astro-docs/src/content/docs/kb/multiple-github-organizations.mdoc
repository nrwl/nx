---
title: Use Repositories from Multiple GitHub Organizations in Nx Cloud
description: Choose an access model and connect repositories from multiple GitHub organizations to one Nx Cloud organization
filter: 'type:Guides'
topics:
  - 'Nx Cloud'
---

A GitHub-connected Nx Cloud organization can only connect repositories from the GitHub organization it is connected to. If your repositories span multiple GitHub organizations, choose an Nx Cloud access model based on how you want to manage users.

## Choose an access model

The licensing details below apply only to Nx Cloud Enterprise customers.

| Access model                                                | Use when                                                                            | Organization setup and Enterprise licensing                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SAML and SCIM                                               | Your identity provider should control access to every workspace centrally.          | Use one organization for all workspaces. Enterprise customers need one license.                                                                                      |
| Multiple GitHub-connected organizations                     | Each GitHub organization must remain a separate administration and access boundary. | Create one Nx Cloud organization for each GitHub organization. Enterprise customers need one license per Nx Cloud organization. Usage reporting is also split.       |
| One standard organization with repository-scoped workspaces | Workspace access should mirror each repository's GitHub contributors.               | Use one Nx Cloud organization for repositories from any number of GitHub organizations. Enterprise customers need one license. This is the recommended GitHub model. |

## Configure repository-scoped access

1. Create a standard Nx Cloud organization without connecting it to a GitHub organization. Use the manual organization setup flow. The warnings shown during this flow are expected.
2. Add a workspace for each repository. The add-workspace flow connects the repository to Nx Cloud through the GitHub App.
3. Grant the Nx Cloud GitHub App access to every repository you add. You can authorize repositories from different GitHub organizations.
4. In each workspace's access settings, select the repository-scoped access type.
5. Ask each user to complete the separate GitHub account connection when Nx Cloud prompts them. Signing in to Nx Cloud with GitHub does not complete this connection. Nx Cloud needs the connection to obtain their GitHub ID and verify that they are a contributor to the connected repository.

Nx Cloud then synchronizes workspace access from the repository's GitHub contributors. Adding or removing access in GitHub updates who can access that workspace without requiring Nx Cloud organization membership.

{% aside type="note" title="Existing GitHub-connected organization" %}
Changing an existing GitHub-connected organization to a standard organization is not a self-service operation. [Contact Nx Cloud support](/contact) to assess converting it without creating a new organization.
{% /aside %}

## Understand the access limitations

- Organization administrator access is managed manually in a standard organization.
- Users with only repository-scoped workspace access do not see the organization in their organization list. They must open the workspace from a direct link, such as a CI Pipeline Execution link in a GitHub pull request comment.
- Nx Cloud normally directs users to the GitHub account connection when it is required. If repository-scoped access does not resolve, confirm that the user completed this connection; signing in with GitHub alone is not sufficient.

## Related configuration

- Review the [Nx Cloud GitHub App permissions](/docs/kb/github-app-permissions) before granting repository access.
- To manage access centrally instead of mirroring GitHub repositories, configure [Okta SAML and SCIM](/docs/enterprise/single-tenant/okta-saml) or [Azure SAML](/docs/enterprise/single-tenant/azure-saml).
