# User Management

## Managing Members
You can use Nx Cloud organizations to manage permissions.

When you create a new organization, you are its only member and admin. You can invite other users using their emails, or using an email domain, in which case everyone under the same domain can join the organization. You can also make sure that members have to log in using their external identity provider (e.g., Google). In this case, if a member loses access to their Google account they will automatically lose the ability to access Nx Cloud.

You can set one of the two roles for everyone you invited:

- Admin (can view runs and stats, edit organization/workspace, modify billing, invite other users, etc.)
- Member (can view runs and stats, but cannot make any changes to any of the workspaces)

## Public Organizations
Sometimes you don't have a known list of members (for instance, for an open-source project). In this case you can change the organization's type to  "public". In a public organization, everyone (including those without an Nx Cloud account) can see and do everything an organization member can see and do.