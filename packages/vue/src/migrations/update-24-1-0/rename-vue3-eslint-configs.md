#### Rename the `vue3-` eslint-plugin-vue configs

eslint-plugin-vue 10 removed the `vue3-essential`, `vue3-strongly-recommended` and `vue3-recommended` configs. Their Vue 3 rules now ship under `essential`, `strongly-recommended` and `recommended`. The migration renames `plugin:vue/vue3-<name>` and `plugin:eslint-plugin-vue/vue3-<name>` references in eslintrc files, flat configs and the `eslintConfig` field of `package.json` files.

It lists ESLint config files that still reference a `vue3-` config in another form, such as `vue.configs['vue3-essential']`, so you can update them by hand.

#### Sample code changes

##### Before

```json title="apps/my-app/.eslintrc.json"
{
  "extends": ["plugin:vue/vue3-essential", "eslint:recommended"]
}
```

##### After

```json title="apps/my-app/.eslintrc.json"
{
  "extends": ["plugin:vue/essential", "eslint:recommended"]
}
```
