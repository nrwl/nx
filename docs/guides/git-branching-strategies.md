# A recommended Git Strategy

We recommend the following:

- Always use Pull Requests when merging code. A PR has two purposes:
  - To initiate a conversation and to get feedback on the implementation
  - To initiate a build and to run tests and lint checks to ensure that
    we don’t break the build
- Avoid long-running branches and don’t merge branches locally
- Enforce a git merging strategy that ensures that feature branches are
  up-to-date before merging. This ensures that these branches are tested
  with the latest code before the merge.

The website [trunkbaseddevelopment.com](trunkbaseddevelopment.com) contains a
lot of very helpful information on trunk-based development and is a great resource.

The following sections are the most pertinent:

- [Feature flags](https://trunkbaseddevelopment.com/feature-flags/)
- [Strategy for migrating code](https://trunkbaseddevelopment.com/branch-by-abstraction/)
- [Feature branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/#breaking-the-contract)
