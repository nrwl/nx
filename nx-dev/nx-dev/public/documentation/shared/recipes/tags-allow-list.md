# Tags Allow List

Sometimes there are specific situations where you want to break the tag rules you've set up for project dependencies.

Each project can set an `allow` property in the project configuration to override the tagging rules that have been set up.

- `"allow": ['@myorg/mylib/testing']` allows importing `'@myorg/mylib/testing'`.
- `"allow": ['@myorg/mylib/*']` allows importing `'@myorg/mylib/a'` but not `'@myorg/mylib/a/b'`.
- `"allow": ['@myorg/mylib/**']` allows importing `'@myorg/mylib/a'` and `'@myorg/mylib/a/b'`.
- `"allow": ['@myorg/**/testing']` allows importing `'@myorg/mylib/testing'` and `'@myorg/nested/lib/testing'`.
