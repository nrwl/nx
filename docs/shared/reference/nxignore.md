# .nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should
be completely ignored by Nx.

The syntax is the same as
a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file are not taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` won't warn about it.
