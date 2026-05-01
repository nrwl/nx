#### Move useDaemonProcess

Move the `useDaemonProcess` to the root of `nx.json`

#### Sample Code Changes

##### Before

```json title="nx.json"
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "useDaemonProcess": false
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "useDaemonProcess": false
}
```
