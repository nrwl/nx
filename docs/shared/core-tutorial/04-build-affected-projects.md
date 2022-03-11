# Core Nx Tutorial - Step 4: Build Affected Projects

Nx scales your development by doing code change analysis to see what apps or libraries are affected by a particular pull request.

**Commit all the changes in the repo**:

```bash
git add .
git commit -am 'init'
git checkout -b testbranch
```

**Open `packages/cli/src/ascii.go` and change the go code:**

```go
package main

import (
  "fmt"
  "os"
)

func check(e error) {
  if e != nil {
      panic(e)
  }
}

func main() {
    fmt.Println("Hello, Dish of the Day")
    dat, err := os.ReadFile("../ascii/assets/cow.txt")
    check(err)
    fmt.Print(string(dat))
}
```

**Run `nx print-affected --select=projects`**, and you should see `cli` printed out. The `nx print-affected` looks at what you have changed and uses the project graph to figure out which projects are affected by this change.

**Now revert those changes**

```bash
git checkout .
```

**Make a change to the shared ASCII art**

Update `packages/ascii/assets/cow.txt`:

```bash
 _____
< Hi! >
 -----
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

**Run `nx print-affected --select=projects`**, and this time you should see `cli`, `blog` and `ascii` printed out.

## Build Affected Projects

Printing the affected projects can be handy, but usually you want to do something with them. For instance, you may want to build everything that has been affected.

**Run `nx affected --target=build` to rebuild only the projects affected by the change.**

```bash
    ✔  nx run blog:build (1s)
    ✔  nx run cli:build (2s)

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects (2s)

   See Nx Cloud run details at https://nx.app/runs/XfhRFaOyGCE
```

Note that Nx only built `blog` and `cli`. It didn't build `ascii` because there is no build script created for it.

## Affected --target=\*

You can run any target against the affected projects in the graph like this:

```bash
nx affected --target=test
```
