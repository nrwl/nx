# web-dev-server

Serve a web application

### Properties

| Name          | Description                                              | Type    | Default value |
| ------------- | -------------------------------------------------------- | ------- | ------------- |
| `buildTarget` | Target which builds the application                      | string  | `undefined`   |
| `port`        | Port to listen on.                                       | number  | `4200`        |
| `host`        | Host to listen on.                                       | string  | `localhost`   |
| `ssl`         | Serve using HTTPS.                                       | boolean | `false`       |
| `sslKey`      | SSL key to use for serving HTTPS.                        | string  | `undefined`   |
| `sslCert`     | SSL certificate to use for serving HTTPS.                | string  | `undefined`   |
| `watch`       | Watches for changes and rebuilds application             | boolean | `true`        |
| `liveReload`  | Whether to reload the page on change, using live-reload. | boolean | `true`        |
| `publicHost`  | Public URL where the application will be served          | string  | `undefined`   |
| `open`        | Open the application in the browser.                     | boolean | `false`       |
