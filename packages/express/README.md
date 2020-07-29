<p align="center"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600"></p>

{{links}}

<hr>

# Express Plugin for Nx

{{what-is-nx}}

{{getting-started}}

```
? What to create in the new workspace (Use arrow keys)
❯ empty             [an empty workspace with a layout that works best for building apps]
  oss               [an empty workspace with a layout that works best for open-source projects]
  web components    [a workspace with a single app built using web components]
  angular           [a workspace with a single Angular application]
  angular-nest      [a workspace with a full stack application (Angular + Nest)]
  react             [a workspace with a single React application]
  react-express     [a workspace with a full stack application (React + Express)]
  next.js           [a workspace with a single Next.js application]
```

Select the preset that works best for you.

```
? Workspace name (e.g., org name)     happyorg
? What to create in the new workspace react-preset    [a workspace with a full stack application (React + Express)]
? Application name                    myapp
? Default stylesheet format           CSS
```

You can also select `empty` and add `@nrwl/express` plugin using yarn or npm, and then generate a new express app using `nx g @nrwl/express:app myapp`.

If it's your first Nx project, the command will recommend you to install the `nx` package globally, so you can invoke `nx` directly without going through yarn or npm.

### Serving Application

- Run `nx serve myapp` to serve the newly generated application!
- Run `nx test myapp` to test it.

You are good to go!

{{resources}}
