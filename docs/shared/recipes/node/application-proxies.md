# Set Up Application Proxies

The Node, Nest and Express application generators have an option to configure other projects in the workspace to proxy API requests. This
can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```shell
nx g @nx/node:app <node-app> --frontendProject my-react-app
nx g @nx/nest:app <nest-app> --frontendProject my-react-app
nx g @nx/express:app <express-app> --frontendProject my-react-app
```

This command will generate and configure a `proxy.conf.json` file that will be used by the frontend project's `serve` target to redirect calls to `/api` to instead go to `http://localhost:3000/api`.

```json {% fileName="/apps/my-react-app/proxy.conf.json" %}
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

For more information on the proxy config file format, see the [Webpack](https://webpack.js.org/configuration/dev-server/#devserverproxy) or [Vite](https://vitejs.dev/config/server-options.html#server-proxy) docs.
