---
title: JavaScript and TypeScript
description: Learn how to use Nx with both JavaScript and TypeScript, including how to generate JS files, mix languages in your workspace, and build TypeScript packages with advanced features.
---

# JavaScript and TypeScript

Nx is a general-purpose build system and a general-purpose CLI. It works with JavaScript, TypeScript, Java, C#, Go, etc.. The core plugins Nx comes with do work best with JavaScript or TypeScript.

TypeScript is a great choice for many teams, but not for everyone. If you want to use Nx with JavaScript, simply pass `--js` to all generate commands, as follows:

```shell
nx g @nx/react:app apps/myapp --js
nx g @nx/react:component apps/myapp/src/lib/mycmp --js
```

You can build/test/lint/serve your applications and libraries the same way whether you use JavaScript and TypeScript. You can also mix and match them.

Regardless whether you use JavaScript or TypeScript, you will have a `tsconfig.base.json` file at the root of the workspace. **It's not used to build the applications and libraries in the workspace. It's only used to improve the editor experience.**

## Interested in building and distributing TypeScript packages?

You might want to check out the `@nx/js` package which comes with advanced TypeScript support, including [SWC](https://swc.rs/) and more. Find out more in the [plugin documentation](/nx-api/js).
