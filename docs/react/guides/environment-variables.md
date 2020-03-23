# Environment Variables

Environment variables are global system variables accessible by all the processes running under the Operating System (OS). Environment variables are useful to store system-wide values such as the directories to search for executable programs (PATH), OS version, Network Information, and custom variables. These env variables are passed at build time and used at the runtime of an app.

## How to Use

It's important to note that NX will only include in the process default and NX prefixed env vars such as: `NODE_ENV` or `NX_CUSTOM_VAR`.

Defining environment variables can vary between OSes. It’s also important to know that this is temporary for the life of the shell session.

**Unix systems**

In Unix systems, we need to pass the env vars before passing the (or other) commands \

Let's say we want to build with development mode, with env vars we can do that like so:

```bash
NODE_ENV=development nx build myapp
```

And if we want to add a custom env var for the command above, it would look like:

```bash
NODE_ENV=development NX_BUILD_NUMBER=123 nx build myapp
```

**Windows (cmd.exe)**

```bash
set "NODE_ENV=development" && nx build myapp
```

**Windows (Powershell)**

```bash
($env:NODE_ENV = "development") -and (nx build myapp)
```
