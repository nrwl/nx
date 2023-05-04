# Nx and Angular Versions

The latest version of Nx supports the [actively supported versions of Angular (current and LTS versions)](https://angular.io/guide/releases#actively-supported-versions). Workspaces in any of those versions are recommended to use the latest version of Nx to benefit from all the new features and fixes.

{% callout type="note" title="Older Nx and Angular versions" %}
The support for multiple versions of Angular in the latest version of Nx was added in **v15.7.0** and started by supporting Angular v14 and v15. If your workspace is in an older version of Angular or you can't update to the latest version of Nx for some reason, please have a look at the next section to know which version of Nx to use.
{% /callout %}

## Nx and Angular Version Compatibility Matrix

Below is a reference table that matches versions of Angular to the version of Nx that is compatible with it. The table shows the version of Angular, the recommended version of Nx to use and the range of Nx versions that support the version of Angular.

We provide a recommended version, and it is usually the latest minor version of Nx in the range provided because there will have been bug fixes added since the first release in the range.

| Angular Version | **Nx Version _(recommended)_** | Nx Version _(range)_                    |
| --------------- | ------------------------------ | --------------------------------------- |
| ~16.0.0         | **latest**                     | 16.1.0 <= latest                        |
| ~15.2.0         | **latest**                     | 15.8.0 <= latest                        |
| ~15.1.0         | **latest**                     | 15.5.0 <= latest                        |
| ~15.0.0         | **latest**                     | 15.2.0 <= 15.4.8 \|\| 15.7.0 <= latest  |
| ~14.2.0         | **latest**                     | 14.6.0 <= 15.1.1 \|\| 15.7.0 <= latest  |
| ~14.1.0         | **latest**                     | 14.5.0 <= 14.5.10 \|\| 15.7.0 <= latest |
| ~14.0.0         | **latest**                     | 14.2.1 <= 14.4.3 \|\| 15.7.0 <= latest  |
| ^13.0.0         | **14.1.9**                     | 13.2.0 <= 14.1.9                        |
| ^12.0.0         | **13.1.4**                     | 12.3.0 <= 13.1.4                        |
| ^11.0.0         | **12.2.0**                     | 11.0.0 <= 12.2.0                        |
| ^10.0.0         | **10.4.15**                    | 9.7.0 <= 10.4.15                        |
| ^9.0.0          | **9.6.0**                      | 8.12.4 <= 9.6.0                         |
| ^8.0.0          | **8.12.2**                     | 8.7.0 <= 8.12.2                         |

Additionally, you can check the supported versions of Node and Typescript for the version of Angular you are using in the [Angular docs](https://angular.io/guide/versions#actively-supported-versions).
