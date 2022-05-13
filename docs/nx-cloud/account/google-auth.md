# Connecting Nx Cloud to your existing Google identity provider

If your organization uses [Google Identity](https://cloud.google.com/identity) or [Google Workspaces](https://workspace.google.com/intl/en_uk/) to manage employee accounts and permissions, your NxCloud workspace members can re-use the same accounts to sign-in to NxCloud and view runs, cache stats etc. Besides being more convenient for the employee, as they don't have to sign-in again, it also has a security benefit: if an employee leaves the company and their Google account is disabled, they won't be able to sign-in to NxCloud anymore.

By default, when you invite a member by email, they can create a separate NxCloud account using their work e-mail address. **If their primary email address gets disabled, they will still be able to sign-in with their NxCloud account, unless you explicitly revoke their membership from the Members page.**

If you'd like them to sign-in with Google directly, which ensures they automatically lose access to their NxCloud account if their email gets disabled, you need to enable this option when inviting them:

![Require Google OAuth Sign-In toggle](/nx-cloud/account/require_google-signin.png)

They will then only be able to accept the invite if they sign-in with Google directly:

![Log In with Google Button](/nx-cloud/account/google_oath.png)

## SAML integration

NxCloud does not currently provide direct integration with SAML identity providers. You can, however, connect your existing SAML provider to Google, and then use the method above to invite employees:

- [Azure AD](https://docs.microsoft.com/en-us/azure/active-directory/saas-apps/google-apps-tutorial)
- [Okta](https://www.okta.com/integrations/google-workspace/#overview)
