# Node Nx Tutorial - Step 7: Test Affected Projects

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/TRRVLyHfN60" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

In addition to supporting computation caching, Nx scales your development by doing code change analysis to see what apps or libraries are affected by a particular pull request.

**Commit all the changes in the repo**:

```bash
git add .
git commit -am 'init'
git checkout -b testbranch
```

**Open `libs/auth/src/lib/auth.controller.ts` and change the controller:**

```typescript
import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get()
  auth() {
    return {
      authenticated: true,
    };
  }

  @Post()
  authenticate(@Body() postData: { username: string; password: string }) {
    const { username, password } = postData;
    // check the database
    console.log(username, password);
  }
}
```

**Run `nx affected:apps`**, and you should see `todos` printed out. The `affected:apps` looks at what you have changed and uses the dependency graph to figure out which apps are affected by this change.

**Run `nx affected:libs`**, and you should see `auth` printed out. This command works similarly, but instead of printing the affected apps, it prints the affected libs.

## Test Affected Projects

Printing the affected projects can be handy, but usually you want to do something with them. For instance, you may want to test everything that has been affected.

**Run `nx affected:test` to retest only the projects affected by the change.**

As you can see, because the code was updated without updating the tests, the unit tests failed.

```bash
>  NX  Running target test for projects:

  - auth
  - todos

...

  Failed projects:

  - todos
```

Note that Nx only tried to retest `auth` and `todos`. It didn't retest `data` because there is no way that library could be affected by the changes in this branch.

## Affected:\*

You can run any target against the affected projects in the graph like this:

```bash
# The following are equivalent
nx affected --target=build
nx affected:build
```
