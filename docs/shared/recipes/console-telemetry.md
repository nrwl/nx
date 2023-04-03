## Nx Console Telemetry

To ensure that we focus on creating features that benefit your day-to-day workflow, we collect some data from the Nx Console extensions.

## Collected Data

Here's the information we collect for each extension.

### User Data

> None of the information that we ask for is used to track any personal information

| Property    | Description                                                                               |
| ----------- | ----------------------------------------------------------------------------------------- |
| Client ID   | These are retrieved by APIs provided by each editor. We do not generate this information. |
| User ID     | We use the same value as the Client ID                                                    |
| Session ID  | Generated UUID                                                                            |
| OS          | What operating system are you using?                                                      |
| Editor      | What editor are you using? Visual Studio Code, Intellij, etc                              |
| App Version | What version of the extension is being used?                                              |

### Event Data

| Property            | Description                        |
| ------------------- | ---------------------------------- |
| Extension Activated | Extension activation timings       |
| Action Triggered    | Nx Generate, Nx Run, Nx Graph, etc |

## Visual Studio Code

For Visual Studio Code, we use the global telemetry setting provided by the editor. This is controlled by the `telemetry.telemetryLevel` setting

#### How to Disable telemetry for Visual Studio Code

Setting `telemetry.telemetryLevel` to `off` will disable telemetry for Nx Console in Visual Studio Code. Read more about the telemetry settings in Visual Studio Code [here](https://code.visualstudio.com/docs/getstarted/telemetry#_disable-telemetry-reporting)

## Jetbrains (IntelliJ, Webstorm, etc)

When the plugin is first installed, we will prompt you to opt in or out of reporting telemetry.

#### How to Disable Telemetry for Jetbrains editors

To turn off telemetry after opting in, go to **Settings** > **Tools** > **Nx Console** > Uncheck **Enable Telemetry**
