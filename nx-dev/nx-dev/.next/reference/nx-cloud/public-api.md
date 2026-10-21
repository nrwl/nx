This is an API reference of the Nx Cloud Public API.
[View OpenAPI specification](https://cloud.nx.app/nx-cloud/data/openapi.json)

Read-only access to Nx Cloud CI data: CI pipeline executions (CIPEs), run groups,
runs, tasks, workflows, steps, instances, agents, daily task statistics,
flaky-task metrics, and Self-Healing CI fixes.

Navigation: each response has a `links` map. Follow the links to reach the entity's
parents and children. A child link is a pre-filled filter URL (a run group's `runs`
link is `/runs?runGroup={id}`). Start from `/cipes`, or from any entity URL you
have. Use the top-level collections to search the workspace. Use the parent-id
filters (`cipeId`, `runGroup`, `stepId`, `agentName`) to list one parent's
children. A parent-id filter is an address: an unknown parent gives 404, never an
empty page.

In-progress entities: CIPEs and run groups are listed while they run, with fields
that are not final yet absent. Their children are reached one level down: a
running CIPE's run groups at its `links.runGroups`, a running run group's finished
runs at its `links.runs`. Fetching a running CIPE or run group by id gives 409
`not_terminal` with the same links. Runs and tasks are never listed in progress: a
run appears in the run lists once its Nx command finishes. Fetching a live run, or
a task of one, by id gives 409 `not_terminal` with no links. Steps, instances and
agents are served once their run group and its workflow finish.

Requests: every endpoint is a `GET`. Each entity has its own path version
(`/nx-cloud/data/{version}/{entity}`). Repeat a key for list filters
(`statuses=FAILED&statuses=CANCELED`). Enum values are not case-sensitive. An
unknown query param gives 400 `invalid_parameter`. Ids are raw: URL-encode them in
a path. Terminal timestamps are `completedAt`.

Authentication: choose one credential set. Send a CI access token in
`Authorization: Bearer <token>`. Or send a personal access token (PAT) in
`Nx-Cloud-Personal-Access-Token: <token>` together with `Nx-Cloud-Id: <id>`.
The Nx Cloud Id identifies the workspace. Only the PAT option requires both headers.
The `nx-cloud api` command authenticates for you with the login `nx login` stores.
OAuth login is the default CLI credential when it is enabled on the instance;
otherwise `nx login` uses a PAT. PATs remain supported.

Pagination: `limit` (1..500, default 100), `sort`
(`ASC` or `DESC`, default `DESC`), and `cursor`. A cursor is opaque and stays valid
only for the list that minted it. Filters do not change that scope. `sort` applies
to the first request only: a cursor carries its own direction. `nextCursor: null`
marks the last page. `prevCursor` pages backward.

API: Nx Cloud Public API. API version: `v1`.

Specification source: `https://cloud.nx.app/nx-cloud/data/openapi.json`.

<a id="get-started-with-the-api"></a>

## Get started with the API

- <a id="authentication"></a>[Authenticate with the Nx Cloud Public API](/docs/kb/authenticate-public-api)
- [Query the Nx Cloud Public API](/docs/kb/query-public-api)

<a id="use-cases"></a>

## Use cases

- [Investigate flaky tasks](/docs/kb/investigate-flaky-tasks-with-api)
- [Debug CI failures](/docs/kb/debug-ci-failures-with-api)
- [Use the API with an AI agent](/docs/kb/use-public-api-with-ai-agent)
- [Read raw resource-utilization reports](/docs/kb/read-resource-utilization-reports)

<a id="operations"></a>

## Endpoint reference

<a id="list-ci-pipeline-executions"></a>

### List CI pipeline executions

`GET` `/nx-cloud/data/v1/cipes`

List the workspace's CI pipeline executions (CIPEs), newest first by default.
In-progress CIPEs are included (`status` NOT_STARTED or IN_PROGRESS): fields that
are not final yet, such as `completedAt`, are absent, the `runGroups` summary
(`total`, `statusCounts`) counts the run groups the CIPE has so far, and
`links.runGroups` lists them. Filter by `branch`, `statuses`, a `createdAt` window,
or run-group `ciExecutionEnvs`.
`cancellationRequest` is optional. To investigate a `CANCELED` status, follow
`links.runGroups`, open the canceled run groups, and inspect their workflow and run links.
A CIPE whose self-healing work was skipped carries `selfHealingSkip` (`reason`,
`message`, `recordedAt`). `links.selfHealingFixes` lists the fixes it has.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-ci-pipeline-executions-parameter-branch"></a>[`branch`](#list-ci-pipeline-executions-parameter-branch) | query | `string` | Match the CIPE branch, its VCS context branch, or its VCS context ref. A pull request's CIPE is found both by the git branch name and by the branch its CI reported, often the pull request number. |
| <a id="list-ci-pipeline-executions-parameter-statuses"></a>[`statuses`](#list-ci-pipeline-executions-parameter-statuses) | query | `string[]` | Select statuses. Omit to include every CIPE, in-progress ones included. Values are case-insensitive. Repeat the key to select multiple values. Example: `["NOT_STARTED"]`. Items: Allowed: `NOT_STARTED`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `CANCELED`, `TIMED_OUT`. Example: `"NOT_STARTED"`. Exploded values. |
| <a id="list-ci-pipeline-executions-parameter-createdafter"></a>[`createdAfter`](#list-ci-pipeline-executions-parameter-createdafter) | query | `string` (`date-time`) | Inclusive lower bound on the CI pipeline execution's createdAt. Supply an ISO-8601 timestamp with a timezone. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-ci-pipeline-executions-parameter-createdbefore"></a>[`createdBefore`](#list-ci-pipeline-executions-parameter-createdbefore) | query | `string` (`date-time`) | Inclusive upper bound on the CI pipeline execution's createdAt. Supply an ISO-8601 timestamp with a timezone. Must not precede createdAfter. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-ci-pipeline-executions-parameter-ciexecutionenvs"></a>[`ciExecutionEnvs`](#list-ci-pipeline-executions-parameter-ciexecutionenvs) | query | `string[]` | Match CIPEs with at least one run group in a selected CI execution environment. Repeat the key to select multiple values. Exploded values. |
| <a id="list-ci-pipeline-executions-parameter-limit"></a>[`limit`](#list-ci-pipeline-executions-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-ci-pipeline-executions-parameter-cursor"></a>[`cursor`](#list-ci-pipeline-executions-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-ci-pipeline-executions-parameter-sort"></a>[`sort`](#list-ci-pipeline-executions-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-1-response-200">
<summary>Response body — 200 OK</summary>

A page of CIPEs ordered by `createdAt` per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_CipeResponse`](#schema-PageResponse_CipeResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "686280000000000000000001",
      "status": "SUCCEEDED",
      "createdAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "workspaceId": "686280000000000000000002",
      "ciExecutionId": "build-42",
      "branch": "main",
      "runGroups": {
        "total": 1,
        "statusCounts": {
          "SUCCEEDED": 1
        }
      },
      "links": {
        "self": "/nx-cloud/data/v1/cipes/686280000000000000000001",
        "runGroups": "/nx-cloud/data/v1/run-groups?cipeId=686280000000000000000001",
        "selfHealingFixes": "/nx-cloud/data/v1/self-healing-fixes?cipeId=686280000000000000000001"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_CipeResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-1 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-ci-pipeline-execution"></a>

### Get a CI pipeline execution

`GET` `/nx-cloud/data/v1/cipes/{cipeId}`

Fetch one terminal CIPE by id. Same shape as a list item, including the `runGroups`
summary and the `links` map. An in-progress CIPE returns 409 with
`links.runGroups`; it appears in the CIPE list while it runs.
`cancellationRequest` is optional. To investigate a `CANCELED`
status, follow `links.runGroups`, open the canceled run groups, and inspect their
workflow and run links.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-ci-pipeline-execution-parameter-cipeid"></a>[`cipeId`](#get-a-ci-pipeline-execution-parameter-cipeid) (required) | path | `string` | The CI pipeline execution's id: 24 hexadecimal characters, not ciExecutionId. |

<details id="operation-2-response-200">
<summary>Response body — 200 OK</summary>

The CIPE.

Content type: `application/json`.

Schema: [`CipeResponse`](#schema-CipeResponse). 

**Example response**

```json
{
  "id": "686280000000000000000001",
  "status": "SUCCEEDED",
  "createdAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "workspaceId": "686280000000000000000002",
  "ciExecutionId": "build-42",
  "branch": "main",
  "runGroups": {
    "total": 1,
    "statusCounts": {
      "SUCCEEDED": 1
    }
  },
  "links": {
    "self": "/nx-cloud/data/v1/cipes/686280000000000000000001",
    "runGroups": "/nx-cloud/data/v1/run-groups?cipeId=686280000000000000000001",
    "selfHealingFixes": "/nx-cloud/data/v1/self-healing-fixes?cipeId=686280000000000000000001"
  }
}
```

[View field definitions](#schema-CipeResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-6 "404 Not Found") • [`409`](#http-response-7 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-run-groups"></a>

### List run groups

`GET` `/nx-cloud/data/v1/run-groups`

List run groups for the workspace. The list uses the parent CIPE's `createdAt`. The
newest CIPE is first by default. Run groups from one CIPE stay together. Filter by
`branch`, `ciExecutionEnv`, `cipeId`, `statuses`, or a
`createdAfter`/`createdBefore` window. A `cipeId` page for an in-progress CIPE holds the
run groups it has so far; the list is complete once the CIPE's status is terminal.

In-progress run groups are included (`status` NOT_STARTED or IN_PROGRESS): fields
that are not final yet are absent, and `links.runs` lists the runs that have
finished. List items contain run-group data. For a terminal run group, follow
`links.self` for run and workflow information.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-run-groups-parameter-branch"></a>[`branch`](#list-run-groups-parameter-branch) | query | `string` | Match the parent CIPE's branch, VCS context branch, or VCS context ref. A pull request's run groups are found both by the git branch name and by the branch its CI reported, often the pull request number. |
| <a id="list-run-groups-parameter-ciexecutionenv"></a>[`ciExecutionEnv`](#list-run-groups-parameter-ciexecutionenv) | query | `string` | Match the CI execution environment name. |
| <a id="list-run-groups-parameter-cipeid"></a>[`cipeId`](#list-run-groups-parameter-cipeid) | query | `string` | Select a parent CI pipeline execution by its id: 24 hexadecimal characters, not ciExecutionId. An unknown parent returns 404. An in-progress CIPE lists the run groups it has so far, and more can follow: the list is complete once the CIPE's status is terminal. |
| <a id="list-run-groups-parameter-statuses"></a>[`statuses`](#list-run-groups-parameter-statuses) | query | `string[]` | Select run-group statuses. Omit to include every status, in-progress run groups included. Values are case-insensitive. Repeat the key to select multiple values. Example: `["NOT_STARTED"]`. Items: Allowed: `NOT_STARTED`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `CANCELED`, `TIMED_OUT`. Example: `"NOT_STARTED"`. Exploded values. |
| <a id="list-run-groups-parameter-createdafter"></a>[`createdAfter`](#list-run-groups-parameter-createdafter) | query | `string` (`date-time`) | Inclusive lower bound on the parent CIPE's createdAt, not the run group's. Supply an ISO-8601 timestamp with a timezone. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-run-groups-parameter-createdbefore"></a>[`createdBefore`](#list-run-groups-parameter-createdbefore) | query | `string` (`date-time`) | Inclusive upper bound on the parent CIPE's createdAt, not the run group's. Supply an ISO-8601 timestamp with a timezone. Must not precede createdAfter. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-run-groups-parameter-limit"></a>[`limit`](#list-run-groups-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-run-groups-parameter-cursor"></a>[`cursor`](#list-run-groups-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-run-groups-parameter-sort"></a>[`sort`](#list-run-groups-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-3-response-200">
<summary>Response body — 200 OK</summary>

A page of run groups ordered by the parent CIPE's `createdAt`.

Content type: `application/json`.

Schema: [`PageResponse_RunGroupListResponse`](#schema-PageResponse_RunGroupListResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "ci-build-42",
      "status": "SUCCEEDED",
      "createdAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "cipeId": "686280000000000000000001",
      "ciExecutionEnv": "linux",
      "links": {
        "self": "/nx-cloud/data/v1/run-groups/ci-build-42",
        "cipe": "/nx-cloud/data/v1/cipes/686280000000000000000001",
        "runs": "/nx-cloud/data/v1/runs?runGroup=ci-build-42",
        "agents": "/nx-cloud/data/v1/run-groups/ci-build-42/agents",
        "selfHealingFixes": "/nx-cloud/data/v1/self-healing-fixes?runGroup=ci-build-42"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_RunGroupListResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-8 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-9 "404 Not Found") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-run-group"></a>

### Get a run group

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}`

Fetch one terminal run group by its id. URL-encode the id in the path. The response
includes run information and optional workflow information. An in-progress run
group returns 409 with `links.runs`; it appears in the run-group list while it runs.

`workflow` describes the Nx managed agent workflow for the run group. It includes its `type`,
status, estimated credits, and summaries for steps, agents, and workflow instances. Follow its
links to list these resources. `workflow` is null when the run group has no Nx managed agent workflow.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-run-group-parameter-rungroupid"></a>[`runGroupId`](#get-a-run-group-parameter-rungroupid) (required) | path | `string` | The run group's id, not cipeId. URL-encode the returned value as one path segment. |

<details id="operation-4-response-200">
<summary>Response body — 200 OK</summary>

The run group with its run summary and optional Nx managed agent workflow.

Content type: `application/json`.

Schema: [`RunGroupResponse`](#schema-RunGroupResponse). 

**Example response**

```json
{
  "id": "ci-build-42",
  "status": "SUCCEEDED",
  "createdAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "cipeId": "686280000000000000000001",
  "ciExecutionEnv": "linux",
  "runs": {
    "total": 1,
    "statusCounts": {
      "SUCCEEDED": 1
    }
  },
  "links": {
    "self": "/nx-cloud/data/v1/run-groups/ci-build-42",
    "cipe": "/nx-cloud/data/v1/cipes/686280000000000000000001",
    "runs": "/nx-cloud/data/v1/runs?runGroup=ci-build-42",
    "agents": "/nx-cloud/data/v1/run-groups/ci-build-42/agents",
    "selfHealingFixes": "/nx-cloud/data/v1/self-healing-fixes?runGroup=ci-build-42"
  }
}
```

[View field definitions](#schema-RunGroupResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-10 "404 Not Found") • [`409`](#http-response-11 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-a-run-groups-workflow-steps"></a>

### List a run group's workflow steps

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/steps`

List the steps of the run group's Nx managed agent workflow. A step runs across the
workflow's agents. Follow `links.instances` to list the workflow instances for that
step. The link selects related rows from the run-group instance collection. Steps
are in position order, with the last step first by default. Filter by execution
`statuses`, `launchTemplate`, `groupName`, or `parallel`.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-a-run-groups-workflow-steps-parameter-rungroupid"></a>[`runGroupId`](#list-a-run-groups-workflow-steps-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="list-a-run-groups-workflow-steps-parameter-statuses"></a>[`statuses`](#list-a-run-groups-workflow-steps-parameter-statuses) | query | `string[]` | Select workflow execution statuses. Values are case-insensitive. Repeat the key to select multiple values. Example: `["UNKNOWN"]`. Items: Allowed: `UNKNOWN`, `NOT_STARTED`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `CANCELED`, `TIMED_OUT`, `MACHINE_TERMINATED`, `SKIPPED`. Example: `"UNKNOWN"`. Exploded values. |
| <a id="list-a-run-groups-workflow-steps-parameter-launchtemplate"></a>[`launchTemplate`](#list-a-run-groups-workflow-steps-parameter-launchtemplate) | query | `string` | Match the launch-template name. |
| <a id="list-a-run-groups-workflow-steps-parameter-groupname"></a>[`groupName`](#list-a-run-groups-workflow-steps-parameter-groupname) | query | `string` | Match the recorded workflow step group. |
| <a id="list-a-run-groups-workflow-steps-parameter-parallel"></a>[`parallel`](#list-a-run-groups-workflow-steps-parameter-parallel) | query | `boolean` | True selects parallel steps; false selects sequential steps. Omit to include both. Example: `true`. |
| <a id="list-a-run-groups-workflow-steps-parameter-limit"></a>[`limit`](#list-a-run-groups-workflow-steps-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-a-run-groups-workflow-steps-parameter-cursor"></a>[`cursor`](#list-a-run-groups-workflow-steps-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-a-run-groups-workflow-steps-parameter-sort"></a>[`sort`](#list-a-run-groups-workflow-steps-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-5-response-200">
<summary>Response body — 200 OK</summary>

A page of workflow steps ordered by position.

Content type: `application/json`.

Schema: [`PageResponse_StepResponse`](#schema-PageResponse_StepResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "agent:nx-tasks",
      "status": "SUCCEEDED",
      "name": "Agent Nx Tasks",
      "parallel": true,
      "position": 0,
      "startedAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "instances": {
        "total": 0,
        "statusCounts": {},
        "restarted": 0,
        "restartAttempts": 0
      },
      "links": {
        "self": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks",
        "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
        "instances": "/nx-cloud/data/v1/run-groups/ci-build-42/instances?stepId=agent%3Anx-tasks",
        "agents": "/nx-cloud/data/v1/run-groups/ci-build-42/agents"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_StepResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-12 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-13 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-run-group-workflow-step"></a>

### Get a run-group workflow step

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/steps/{stepId}`

Fetch one workflow step by its URL-encoded step ID. Follow `links.instances` to list
the workflow instances for that step.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-run-group-workflow-step-parameter-rungroupid"></a>[`runGroupId`](#get-a-run-group-workflow-step-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="get-a-run-group-workflow-step-parameter-stepid"></a>[`stepId`](#get-a-run-group-workflow-step-parameter-stepid) (required) | path | `string` | The step response's id, not its display name. It can contain colons; URL-encode it as one path segment. |

<details id="operation-6-response-200">
<summary>Response body — 200 OK</summary>

The workflow step.

Content type: `application/json`.

Schema: [`StepResponse`](#schema-StepResponse). 

**Example response**

```json
{
  "id": "agent:nx-tasks",
  "status": "SUCCEEDED",
  "name": "Agent Nx Tasks",
  "parallel": true,
  "position": 0,
  "startedAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "instances": {
    "total": 0,
    "statusCounts": {},
    "restarted": 0,
    "restartAttempts": 0
  },
  "links": {
    "self": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks",
    "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
    "instances": "/nx-cloud/data/v1/run-groups/ci-build-42/instances?stepId=agent%3Anx-tasks",
    "agents": "/nx-cloud/data/v1/run-groups/ci-build-42/agents"
  }
}
```

[View field definitions](#schema-StepResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-15 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-a-run-groups-workflow-instances"></a>

### List a run group's workflow instances

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/instances`

List the workflow instances for a run group. Each instance is one step run on one
Nx managed agent. BYOC agents do not have workflow instances. Use `stepId` to select
one step across agents. Use `agentName` to select one agent across steps. Use both
parameters to select one workflow instance.

These collection views use one pagination and filter model. Path parameters identify
one resource. Query parameters select a related subset of this collection. Follow
response links. Do not construct URLs from IDs.

Narrow the result by `statuses`, a `startedAfter`/`startedBefore` window, or
`restarted`.

Each row represents one workflow step on one agent, not one agent boot. Agent restarts share a
row; `restartAttempts` counts superseded executions. Each row includes the selected
execution's step, agent, status, times, and an available logs asset.
Follow `links.self` for `resourceUsage`, `terminationStatuses`, `timeoutInfo`, and `priorRuns`.
When `links.agent` exists, it identifies the Nx managed agent that ran the step. Older executions
can lack `agentName`; their `links.self` still provides the instance address.
Missing start times remain absent in responses, but use `1970-01-01T00:00:00Z` for date
filtering and sorting.

The selected execution has the latest start time, unless a restart boot selected in an earlier
workflow step remains available for this step. Start-time ties use the last recorded execution.
The other executions appear in `priorRuns`, sorted by start time then name in ascending order;
they can start after the selected execution. Selection does not depend on the list's sort direction.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-a-run-groups-workflow-instances-parameter-rungroupid"></a>[`runGroupId`](#list-a-run-groups-workflow-instances-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="list-a-run-groups-workflow-instances-parameter-stepid"></a>[`stepId`](#list-a-run-groups-workflow-instances-parameter-stepid) | query | `string` | Select workflow instances for one step by the step response's id. URL-encode it as a query value. An unknown step returns 404. |
| <a id="list-a-run-groups-workflow-instances-parameter-agentname"></a>[`agentName`](#list-a-run-groups-workflow-instances-parameter-agentname) | query | `string` | Select workflow instances for one agent by the agent response's name. URL-encode it as a query value. An unknown agent returns 404. |
| <a id="list-a-run-groups-workflow-instances-parameter-statuses"></a>[`statuses`](#list-a-run-groups-workflow-instances-parameter-statuses) | query | `string[]` | Select workflow execution statuses. Values are case-insensitive. Repeat the key to select multiple values. Example: `["UNKNOWN"]`. Items: Allowed: `UNKNOWN`, `NOT_STARTED`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `CANCELED`, `TIMED_OUT`, `MACHINE_TERMINATED`, `SKIPPED`. Example: `"UNKNOWN"`. Exploded values. |
| <a id="list-a-run-groups-workflow-instances-parameter-startedafter"></a>[`startedAfter`](#list-a-run-groups-workflow-instances-parameter-startedafter) | query | `string` (`date-time`) | Inclusive lower bound on startedAt. Missing start times use 1970-01-01T00:00:00Z for date filtering. Supply an ISO-8601 timestamp with a timezone. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-a-run-groups-workflow-instances-parameter-startedbefore"></a>[`startedBefore`](#list-a-run-groups-workflow-instances-parameter-startedbefore) | query | `string` (`date-time`) | Inclusive upper bound on startedAt. Missing start times use 1970-01-01T00:00:00Z for date filtering. Supply an ISO-8601 timestamp with a timezone. Must not precede startedAfter. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-a-run-groups-workflow-instances-parameter-restarted"></a>[`restarted`](#list-a-run-groups-workflow-instances-parameter-restarted) | query | `boolean` | True selects workflow instances with superseded executions after an agent restart; false selects instances without them. Omit to include both. Example: `true`. |
| <a id="list-a-run-groups-workflow-instances-parameter-limit"></a>[`limit`](#list-a-run-groups-workflow-instances-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-a-run-groups-workflow-instances-parameter-cursor"></a>[`cursor`](#list-a-run-groups-workflow-instances-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-a-run-groups-workflow-instances-parameter-sort"></a>[`sort`](#list-a-run-groups-workflow-instances-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-7-response-200">
<summary>Response body — 200 OK</summary>

A page of workflow instances ordered by `startedAt`.

Content type: `application/json`.

Schema: [`PageResponse_InstanceRowResponse`](#schema-PageResponse_InstanceRowResponse). 

**Example response**

```json
{
  "items": [
    {
      "stepId": "agent:nx-tasks",
      "stepName": "Agent Nx Tasks",
      "agentName": "agent-1",
      "name": "agent-1-boot-1",
      "status": "SUCCEEDED",
      "startedAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "assets": [],
      "links": {
        "self": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks/instances/agent-1",
        "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
        "step": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks",
        "agent": "/nx-cloud/data/v1/run-groups/ci-build-42/agents/agent-1"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_InstanceRowResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-12 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-16 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-run-group-workflow-instance"></a>

### Get a run-group workflow instance

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/steps/{stepId}/instances/{agentName}`

Fetch one workflow instance by its step id and agent name. This response includes
`resourceUsage`, `terminationStatuses`, `timeoutInfo`, and `priorRuns`.

The selected execution has the latest start time, unless a restart boot selected in an earlier
workflow step remains available for this step. Start-time ties use the last recorded execution.
The other executions appear in `priorRuns`, sorted by start time then name in ascending order;
they can start after the selected execution. Selection does not depend on the list's sort direction.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-run-group-workflow-instance-parameter-rungroupid"></a>[`runGroupId`](#get-a-run-group-workflow-instance-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="get-a-run-group-workflow-instance-parameter-stepid"></a>[`stepId`](#get-a-run-group-workflow-instance-parameter-stepid) (required) | path | `string` | The step's id, which can contain colons. URL-encode it as one path segment. |
| <a id="get-a-run-group-workflow-instance-parameter-agentname"></a>[`agentName`](#get-a-run-group-workflow-instance-parameter-agentname) (required) | path | `string` | The instance's agent address. URL-encode agentName as one path segment, or follow links.self when agentName is absent. |

<details id="operation-8-response-200">
<summary>Response body — 200 OK</summary>

The workflow instance.

Content type: `application/json`.

Schema: [`InstanceResponse`](#schema-InstanceResponse). 

**Example response**

```json
{
  "stepId": "agent:nx-tasks",
  "stepName": "Agent Nx Tasks",
  "agentName": "agent-1",
  "name": "agent-1-boot-1",
  "status": "SUCCEEDED",
  "startedAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "assets": [],
  "links": {
    "self": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks/instances/agent-1",
    "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
    "step": "/nx-cloud/data/v1/run-groups/ci-build-42/steps/agent%3Anx-tasks",
    "agent": "/nx-cloud/data/v1/run-groups/ci-build-42/agents/agent-1"
  }
}
```

[View field definitions](#schema-InstanceResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-17 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="download-a-run-group-workflow-instances-logs"></a>

### Download a run-group workflow instance's logs

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/steps/{stepId}/instances/{agentName}/assets/{type}`

Download one step's output on one agent. Omit `run` for the selected execution's logs.
Pass `?run=` for a superseded execution's logs; the zero-based value indexes `priorRuns`,
oldest first.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="download-a-run-group-workflow-instances-logs-parameter-rungroupid"></a>[`runGroupId`](#download-a-run-group-workflow-instances-logs-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="download-a-run-group-workflow-instances-logs-parameter-stepid"></a>[`stepId`](#download-a-run-group-workflow-instances-logs-parameter-stepid) (required) | path | `string` | The step's id, which can contain colons. URL-encode it as one path segment. |
| <a id="download-a-run-group-workflow-instances-logs-parameter-agentname"></a>[`agentName`](#download-a-run-group-workflow-instances-logs-parameter-agentname) (required) | path | `string` | The instance's agent address. URL-encode agentName as one path segment, or follow an assets URL when agentName is absent. |
| <a id="download-a-run-group-workflow-instances-logs-parameter-type"></a>[`type`](#download-a-run-group-workflow-instances-logs-parameter-type) (required) | path | `string` | The asset type: `logs`. |
| <a id="download-a-run-group-workflow-instances-logs-parameter-run"></a>[`run`](#download-a-run-group-workflow-instances-logs-parameter-run) | query | `integer` (`int32`) | Optional: zero-based index into priorRuns, oldest first. Omit to download the selected execution's logs. |

<a id="operation-9-response-302"></a>

**302 Found**

A redirect to the asset's download URL.

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

Other response codes: [`400`](#http-response-18 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-19 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-a-run-groups-agents"></a>

### List a run group's agents

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/agents`

List the agents for a run group. Filter by `statuses` or `launchTemplate`. An agent
is `ONLINE` when its selected boot has no recorded offline time. This is not a live
health check. Each agent includes its selected boot's CPU, memory, and utilization summary.

An Nx managed agent also includes workflow instance totals and workflow links.
Follow `links.instances` to list the workflow instances for that agent. Bring your
own compute (BYOC) agents have an empty instance summary and no workflow links. A
`resource-utilization` asset is present when a report exists.

The response uses the last boot in ascending online-time order. For Nx managed agents,
boots without online times come first, and ties use recorded boot order. For BYOC agents,
missing online times use `1970-01-01T00:00:00Z`, and ties use `instanceName` order.
That boot supplies the status, metrics, and default resource-utilization asset.
`priorBoots` contains the other boots in the same ascending order. This boot selection
does not depend on the agent list's requested sort direction.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-a-run-groups-agents-parameter-rungroupid"></a>[`runGroupId`](#list-a-run-groups-agents-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="list-a-run-groups-agents-parameter-statuses"></a>[`statuses`](#list-a-run-groups-agents-parameter-statuses) | query | `string[]` | Select ONLINE or OFFLINE agents from the selected boot's recorded times, not a live probe. ONLINE means no offline time was recorded. Values are case-insensitive. Repeat the key to select multiple values. Example: `["ONLINE"]`. Items: Allowed: `ONLINE`, `OFFLINE`. Example: `"ONLINE"`. Exploded values. |
| <a id="list-a-run-groups-agents-parameter-launchtemplate"></a>[`launchTemplate`](#list-a-run-groups-agents-parameter-launchtemplate) | query | `string` | Match the launch-template name. |
| <a id="list-a-run-groups-agents-parameter-limit"></a>[`limit`](#list-a-run-groups-agents-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-a-run-groups-agents-parameter-cursor"></a>[`cursor`](#list-a-run-groups-agents-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-a-run-groups-agents-parameter-sort"></a>[`sort`](#list-a-run-groups-agents-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-10-response-200">
<summary>Response body — 200 OK</summary>

A page of the run group's agents ordered by `onlineAt`.

Content type: `application/json`.

Schema: [`PageResponse_AgentResponse`](#schema-PageResponse_AgentResponse). 

**Example response**

```json
{
  "items": [
    {
      "name": "agent-1",
      "status": "OFFLINE",
      "instanceName": "agent-1-boot-1",
      "cpuCores": 4,
      "totalMemory": 8589934592,
      "onlineAt": "2026-06-30T12:00:00Z",
      "offlineAt": "2026-06-30T12:01:00Z",
      "instances": {
        "total": 0,
        "statusCounts": {},
        "restarted": 0,
        "restartAttempts": 0
      },
      "assets": [],
      "links": {
        "self": "/nx-cloud/data/v1/run-groups/ci-build-42/agents/agent-1",
        "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_AgentResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-12 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-20 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-an-agent"></a>

### Get an agent

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/agents/{agentName}`

Fetch one BYOC or Nx managed agent by its name. URL-encode the list item's raw `name`
in the path. The response includes other boots in `priorBoots`, when present.

The response uses the last boot in ascending online-time order. For Nx managed agents,
boots without online times come first, and ties use recorded boot order. For BYOC agents,
missing online times use `1970-01-01T00:00:00Z`, and ties use `instanceName` order.
That boot supplies the status, metrics, and default resource-utilization asset.
`priorBoots` contains the other boots in the same ascending order. This boot selection
does not depend on the agent list's requested sort direction.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-an-agent-parameter-rungroupid"></a>[`runGroupId`](#get-an-agent-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="get-an-agent-parameter-agentname"></a>[`agentName`](#get-an-agent-parameter-agentname) (required) | path | `string` | The agent response's name, not instanceName. URL-encode it as one path segment. |

<details id="operation-11-response-200">
<summary>Response body — 200 OK</summary>

The agent.

Content type: `application/json`.

Schema: [`AgentResponse`](#schema-AgentResponse). 

**Example response**

```json
{
  "name": "agent-1",
  "status": "OFFLINE",
  "instanceName": "agent-1-boot-1",
  "cpuCores": 4,
  "totalMemory": 8589934592,
  "onlineAt": "2026-06-30T12:00:00Z",
  "offlineAt": "2026-06-30T12:01:00Z",
  "instances": {
    "total": 0,
    "statusCounts": {},
    "restarted": 0,
    "restartAttempts": 0
  },
  "assets": [],
  "links": {
    "self": "/nx-cloud/data/v1/run-groups/ci-build-42/agents/agent-1",
    "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42"
  }
}
```

[View field definitions](#schema-AgentResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-21 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="download-an-agents-resource-utilization-report"></a>

### Download an agent's resource-utilization report

`GET` `/nx-cloud/data/v1/run-groups/{runGroupId}/agents/{agentName}/assets/{type}`

Get the agent's full per-sample resource-utilization report (CPU, memory, and I/O).
Pass `?boot=` for a prior record. The value is zero-based, oldest-first, and indexes
`priorBoots`.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="download-an-agents-resource-utilization-report-parameter-rungroupid"></a>[`runGroupId`](#download-an-agents-resource-utilization-report-parameter-rungroupid) (required) | path | `string` | The run group's id, as returned by the run-groups API. URL-encode it as one path segment. |
| <a id="download-an-agents-resource-utilization-report-parameter-agentname"></a>[`agentName`](#download-an-agents-resource-utilization-report-parameter-agentname) (required) | path | `string` | The agent response's name, not instanceName. URL-encode it as one path segment. |
| <a id="download-an-agents-resource-utilization-report-parameter-type"></a>[`type`](#download-an-agents-resource-utilization-report-parameter-type) (required) | path | `string` | The asset type: `resource-utilization`. |
| <a id="download-an-agents-resource-utilization-report-parameter-boot"></a>[`boot`](#download-an-agents-resource-utilization-report-parameter-boot) | query | `integer` (`int32`) | Optional: zero-based index into priorBoots, oldest first. Omit to download the selected boot's report. |

<a id="operation-12-response-302"></a>

**302 Found**

A redirect to the asset's download URL.

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

Other response codes: [`400`](#http-response-18 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-22 "404 Not Found") • [`409`](#http-response-14 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-runs"></a>

### List runs

`GET` `/nx-cloud/data/v1/runs`

List the workspace's runs (one Nx invocation on an agent or machine), newest first
by default. A run is listed once its Nx command finishes; runs are never listed in
progress in this API. Filter by `runGroup`, `ciExecutionEnv`, `branch`, `statuses`,
`hasRetriedTasks` (`true` = at least one retried task, `false` = no retried tasks), or a `createdAt`
window. The `runGroup` filter is an address: an unknown run group gives 404, never
an empty page. An in-progress run group lists the runs that have finished so far;
the list is complete once the run group's status is terminal.
List items contain run metadata only. Follow `links.self` for the task summary or
`links.tasks` for the paginated task collection.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-runs-parameter-rungroup"></a>[`runGroup`](#list-runs-parameter-rungroup) | query | `string` | Select a parent by the run group's id, not the CIPE id. URL-encode it as a query value. An unknown parent returns 404. An in-progress run group lists the runs that have finished so far, and more can follow: the list is complete once the run group's status is terminal. |
| <a id="list-runs-parameter-ciexecutionenv"></a>[`ciExecutionEnv`](#list-runs-parameter-ciexecutionenv) | query | `string` | Match the CI execution environment name. |
| <a id="list-runs-parameter-branch"></a>[`branch`](#list-runs-parameter-branch) | query | `string` | Match the recorded branch name. |
| <a id="list-runs-parameter-statuses"></a>[`statuses`](#list-runs-parameter-statuses) | query | `string[]` | Select run statuses derived from the exit code, not a live progress state. Values are case-insensitive. Repeat the key to select multiple values. Example: `["UNKNOWN"]`. Items: Allowed: `UNKNOWN`, `SUCCEEDED`, `CANCELED`, `FAILED`. Example: `"UNKNOWN"`. Exploded values. |
| <a id="list-runs-parameter-hasretriedtasks"></a>[`hasRetriedTasks`](#list-runs-parameter-hasretriedtasks) | query | `boolean` | True selects runs with retried tasks; false selects runs without retried tasks. Omit to include both. Example: `true`. |
| <a id="list-runs-parameter-createdafter"></a>[`createdAfter`](#list-runs-parameter-createdafter) | query | `string` (`date-time`) | Inclusive lower bound on createdAt. Supply an ISO-8601 timestamp with a timezone. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-runs-parameter-createdbefore"></a>[`createdBefore`](#list-runs-parameter-createdbefore) | query | `string` (`date-time`) | Inclusive upper bound on createdAt. Supply an ISO-8601 timestamp with a timezone. Must not precede createdAfter. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-runs-parameter-limit"></a>[`limit`](#list-runs-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-runs-parameter-cursor"></a>[`cursor`](#list-runs-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-runs-parameter-sort"></a>[`sort`](#list-runs-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-13-response-200">
<summary>Response body — 200 OK</summary>

A page of runs ordered by `createdAt` per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_RunListResponse`](#schema-PageResponse_RunListResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "run-build-42",
      "status": "SUCCEEDED",
      "createdAt": "2026-06-30T12:00:00Z",
      "startedAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "command": "nx build myapp",
      "branch": "main",
      "runGroup": "ci-build-42",
      "cacheEnabled": true,
      "isDTE": false,
      "isCI": true,
      "links": {
        "self": "/nx-cloud/data/v1/runs/run-build-42",
        "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
        "tasks": "/nx-cloud/data/v1/runs/run-build-42/tasks"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_RunListResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-23 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-24 "404 Not Found") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-run"></a>

### Get a run

`GET` `/nx-cloud/data/v1/runs/{runId}`

Fetch one run by its `id`, the identifier used in Nx Cloud run URLs. Unlike a list
item, this response includes the `tasks` summary. `links.tasks` lists the tasks (`GET /runs/{id}/tasks`).

The run includes a `tasks` summary: `total`, per-status `statusCounts`, `retried`
(tasks with at least one prior attempt), `retryAttempts` (the prior attempts), and
`retriedStatusCounts` (the retried tasks' final statuses). The `links` map gives the run, its
run group when recorded, and the paginated `tasks` collection.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-run-parameter-runid"></a>[`runId`](#get-a-run-parameter-runid) (required) | path | `string` | The run's id, as returned by the runs API. URL-encode it as one path segment. |

<details id="operation-14-response-200">
<summary>Response body — 200 OK</summary>

The run.

Content type: `application/json`.

Schema: [`RunResponse`](#schema-RunResponse). 

**Example response**

```json
{
  "id": "run-build-42",
  "status": "SUCCEEDED",
  "createdAt": "2026-06-30T12:00:00Z",
  "startedAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "command": "nx build myapp",
  "branch": "main",
  "runGroup": "ci-build-42",
  "cacheEnabled": true,
  "isDTE": false,
  "isCI": true,
  "tasks": {
    "total": 1,
    "statusCounts": {
      "SUCCEEDED": 1
    },
    "retried": 0,
    "retryAttempts": 0,
    "retriedStatusCounts": {}
  },
  "links": {
    "self": "/nx-cloud/data/v1/runs/run-build-42",
    "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
    "tasks": "/nx-cloud/data/v1/runs/run-build-42/tasks"
  }
}
```

[View field definitions](#schema-RunResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-25 "404 Not Found") • [`409`](#http-response-26 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-a-runs-tasks"></a>

### List a run's tasks

`GET` `/nx-cloud/data/v1/runs/{runId}/tasks`

List the tasks of one run (one project-target execution each), the run given by the
`{runId}` path segment. Narrow by `taskId`, `statuses`, `projectName`, `target`,
`cacheStatus`, `agentName` (DTE runs only), `retried` (`true` = only tasks with a
prior attempt, `false` = only tasks that never retried), or a `startedAt` window.
Task statuses are `UNKNOWN`, `SUCCEEDED`, `FAILED`, `CANCELED`, `NOT_STARTED`,
`DEPENDENCIES_FAILED`, `NOT_EXECUTABLE`, `TIMED_OUT`, and `SCHEDULED_IMPLICITLY`.
Each task can expose terminal output, a cache artifact, and an Ultracache report
(asset type `sandbox-report`) in `assets`. A cache artifact is present only after
upload or cache replay. Failed earlier executions appear as `priorAttempts`. The `assets` and `priorAttempts`
collections can be empty. A task that stopped before completion can have null
`startedAt`, `completedAt`, `cacheStatus`, or `hash` fields. The `params` field can
be an empty string. The `links` map gives the task and its parent run.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-a-runs-tasks-parameter-runid"></a>[`runId`](#list-a-runs-tasks-parameter-runid) (required) | path | `string` | The run's id, as returned by the runs API. URL-encode it as one path segment. |
| <a id="list-a-runs-tasks-parameter-taskid"></a>[`taskId`](#list-a-runs-tasks-parameter-taskid) | query | `string` | Match an Nx task id in project:target[:configuration] form, such as myapp:build. URL-encode it as a query value. Batch variants can share an id. |
| <a id="list-a-runs-tasks-parameter-statuses"></a>[`statuses`](#list-a-runs-tasks-parameter-statuses) | query | `string[]` | Select task statuses. Values are case-insensitive. Repeat the key to select multiple values. Example: `["UNKNOWN"]`. Items: Allowed: `UNKNOWN`, `SUCCEEDED`, `FAILED`, `CANCELED`, `NOT_STARTED`, `DEPENDENCIES_FAILED`, `NOT_EXECUTABLE`, `TIMED_OUT`, `SCHEDULED_IMPLICITLY`. Example: `"UNKNOWN"`. Exploded values. |
| <a id="list-a-runs-tasks-parameter-projectname"></a>[`projectName`](#list-a-runs-tasks-parameter-projectname) | query | `string` | Match the Nx project name. |
| <a id="list-a-runs-tasks-parameter-target"></a>[`target`](#list-a-runs-tasks-parameter-target) | query | `string` | Match the Nx target name. |
| <a id="list-a-runs-tasks-parameter-cachestatus"></a>[`cacheStatus`](#list-a-runs-tasks-parameter-cachestatus) | query | `string` | Match the recorded cache status. |
| <a id="list-a-runs-tasks-parameter-agentname"></a>[`agentName`](#list-a-runs-tasks-parameter-agentname) | query | `string` | Match the last non-skipped agent assignment in a distributed run (DTE). Tasks without an agent assignment and non-DTE runs do not match. Cache hits can match if an assignment exists. |
| <a id="list-a-runs-tasks-parameter-startedafter"></a>[`startedAfter`](#list-a-runs-tasks-parameter-startedafter) | query | `string` (`date-time`) | Inclusive lower bound on startedAt. Missing start times use 1970-01-01T00:00:00Z for date filtering. Supply an ISO-8601 timestamp with a timezone. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-a-runs-tasks-parameter-startedbefore"></a>[`startedBefore`](#list-a-runs-tasks-parameter-startedbefore) | query | `string` (`date-time`) | Inclusive upper bound on startedAt. Missing start times use 1970-01-01T00:00:00Z for date filtering. Supply an ISO-8601 timestamp with a timezone. Must not precede startedAfter. Example: `"2026-06-30T12:00:00Z"`. |
| <a id="list-a-runs-tasks-parameter-retried"></a>[`retried`](#list-a-runs-tasks-parameter-retried) | query | `boolean` | True selects tasks with prior attempts; false selects tasks without prior attempts. Omit to include both. Example: `true`. |
| <a id="list-a-runs-tasks-parameter-limit"></a>[`limit`](#list-a-runs-tasks-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-a-runs-tasks-parameter-cursor"></a>[`cursor`](#list-a-runs-tasks-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-a-runs-tasks-parameter-sort"></a>[`sort`](#list-a-runs-tasks-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-15-response-200">
<summary>Response body — 200 OK</summary>

A page of the run's tasks ordered by `startedAt` per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_TaskResponse`](#schema-PageResponse_TaskResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "myapp:build",
      "status": "SUCCEEDED",
      "startedAt": "2026-06-30T12:00:00Z",
      "completedAt": "2026-06-30T12:01:00Z",
      "projectName": "myapp",
      "target": "build",
      "params": "",
      "cacheStatus": "cache-miss",
      "hash": "abc123",
      "continuous": false,
      "cacheable": true,
      "assets": [
        {
          "type": "logs",
          "url": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Abuild/assets/logs"
        }
      ],
      "links": {
        "self": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Abuild",
        "run": "/nx-cloud/data/v1/runs/run-build-42"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_TaskResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-27 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-25 "404 Not Found") • [`409`](#http-response-26 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-task"></a>

### Get a task

`GET` `/nx-cloud/data/v1/runs/{runId}/tasks/{taskId}`

Fetch one task of a run by its task id (a list item's `id`, e.g. `myapp:build`),
URL-encoded as one path segment. The id is not unique within a run (batched or
continuous tasks can repeat it). Pass `?batchId=` to select one entry; otherwise
the first match returns. Pass `?include=cacheOrigin` to add a source-run link filtered
by task id in `links.cacheOrigin`. The response has the task's `assets` and failed
`priorAttempts`.
These collections can be empty. A task that stopped before completion can have null
timestamps, `cacheStatus`, or `hash`. The `params` field can
be an empty string.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-task-parameter-runid"></a>[`runId`](#get-a-task-parameter-runid) (required) | path | `string` | The run's id, as returned by the runs API. URL-encode it as one path segment. |
| <a id="get-a-task-parameter-taskid"></a>[`taskId`](#get-a-task-parameter-taskid) (required) | path | `string` | The task response's id, such as myapp:build. URL-encode it as one path segment; use batchId to distinguish variants. |
| <a id="get-a-task-parameter-batchid"></a>[`batchId`](#get-a-task-parameter-batchid) | query | `string` | Optional: the task response's batchId, URL-encoded as a query value, to distinguish tasks with the same id. |
| <a id="get-a-task-parameter-include"></a>[`include`](#get-a-task-parameter-include) | query | [`TaskInclude`](#schema-TaskInclude) | Optional expansion. The supported value is `cacheOrigin`. |

<details id="operation-16-response-200">
<summary>Response body — 200 OK</summary>

The task.

Content type: `application/json`.

Schema: [`TaskResponse`](#schema-TaskResponse). 

**Example response**

```json
{
  "id": "myapp:build",
  "status": "SUCCEEDED",
  "startedAt": "2026-06-30T12:00:00Z",
  "completedAt": "2026-06-30T12:01:00Z",
  "projectName": "myapp",
  "target": "build",
  "params": "",
  "cacheStatus": "cache-miss",
  "hash": "abc123",
  "continuous": false,
  "cacheable": true,
  "assets": [
    {
      "type": "logs",
      "url": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Abuild/assets/logs"
    }
  ],
  "links": {
    "self": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Abuild",
    "run": "/nx-cloud/data/v1/runs/run-build-42"
  }
}
```

[View field definitions](#schema-TaskResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-28 "404 Not Found") • [`409`](#http-response-29 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="download-a-task-asset"></a>

### Download a task asset

`GET` `/nx-cloud/data/v1/runs/{runId}/tasks/{taskId}/assets/{type}`

Get one task asset: `logs`, `artifact`, or `sandbox-report` (the Ultracache
report). Pass `?batchId=` to
disambiguate batched or continuous tasks that share a taskId. Pass `?attempt=`
(0-based, oldest-first) for a prior failed attempt's logs.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="download-a-task-asset-parameter-runid"></a>[`runId`](#download-a-task-asset-parameter-runid) (required) | path | `string` | The run's id, as returned by the runs API. URL-encode it as one path segment. |
| <a id="download-a-task-asset-parameter-taskid"></a>[`taskId`](#download-a-task-asset-parameter-taskid) (required) | path | `string` | The task response's id, such as myapp:build. URL-encode it as one path segment; use batchId to distinguish variants. |
| <a id="download-a-task-asset-parameter-type"></a>[`type`](#download-a-task-asset-parameter-type) (required) | path | `string` | The asset type: `logs`, `artifact`, or `sandbox-report` (the Ultracache report). |
| <a id="download-a-task-asset-parameter-batchid"></a>[`batchId`](#download-a-task-asset-parameter-batchid) | query | `string` | Optional: the task response's batchId, URL-encoded as a query value, to distinguish tasks with the same id. |
| <a id="download-a-task-asset-parameter-attempt"></a>[`attempt`](#download-a-task-asset-parameter-attempt) | query | `integer` (`int32`) | Optional for logs only: zero-based index into priorAttempts, oldest first. Omit to download the final attempt's asset. |

<a id="operation-17-response-302"></a>

**302 Found**

A redirect to the asset's download URL.

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

Other response codes: [`400`](#http-response-18 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-30 "404 Not Found") • [`409`](#http-response-29 "409 Conflict") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-daily-task-statistics"></a>

### List daily task statistics

`GET` `/nx-cloud/data/v1/task-stats`

List daily task statistics for the workspace. Each row groups tasks by Nx project,
target, target group, and CI or local execution for one UTC day based on run creation
time. Only cache-enabled runs contribute; continuous tasks and nx-cloud start-agent
runs are excluded. Cache and exit-code ratios use `totalCount` as their denominator
and are fractions from 0 to 1. A `target` filter requires `projectName`.
`dateAfter` and `dateBefore` accept an ISO-8601 date (2026-06-30) or timestamp and
bound inclusive whole UTC days: a timestamp bounds the UTC day that contains it.
Repeat `percentiles` with up to five unique integers from 0 to 100. For example,
use `percentiles=50&percentiles=95` to request P50 and P95. Each percentile is an
approximate successful cache-miss duration in milliseconds; negative durations are
excluded. Do not average row percentiles to calculate an overall percentile.
The response omits `durationPercentiles` when no percentiles are requested.
A percentile's `cacheMissMs` is null when available duration data is insufficient;
null is not zero and does not prove that no cache misses occurred.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-daily-task-statistics-parameter-projectname"></a>[`projectName`](#list-daily-task-statistics-parameter-projectname) | query | `string` | Match the Nx project name. |
| <a id="list-daily-task-statistics-parameter-target"></a>[`target`](#list-daily-task-statistics-parameter-target) | query | `string` | Match the Nx target name. Requires projectName. |
| <a id="list-daily-task-statistics-parameter-isci"></a>[`isCI`](#list-daily-task-statistics-parameter-isci) | query | `boolean` | Select CI statistics with true or local statistics with false. Runs with a branch value count as CI. Omit to include both. Example: `true`. |
| <a id="list-daily-task-statistics-parameter-dateafter"></a>[`dateAfter`](#list-daily-task-statistics-parameter-dateafter) | query | `string` (`date`) or `string` (`date-time`) | Inclusive first UTC day. Accepts an ISO-8601 date or timestamp; timestamps select their containing UTC day. Example: `"2026-06-30"`. |
| <a id="list-daily-task-statistics-parameter-datebefore"></a>[`dateBefore`](#list-daily-task-statistics-parameter-datebefore) | query | `string` (`date`) or `string` (`date-time`) | Inclusive last UTC day. Accepts an ISO-8601 date or timestamp. Must not precede dateAfter. Example: `"2026-06-30"`. |
| <a id="list-daily-task-statistics-parameter-percentiles"></a>[`percentiles`](#list-daily-task-statistics-parameter-percentiles) | query | `integer[]` (`int32`) | Request up to five unique percentiles from 0 to 100, such as percentiles=50&percentiles=95. Omit to exclude durationPercentiles. Repeat the key to select multiple values. minItems: `1`. maxItems: `5`. uniqueItems: `true`. Items: minimum: `0`. maximum: `100`. Exploded values. |
| <a id="list-daily-task-statistics-parameter-limit"></a>[`limit`](#list-daily-task-statistics-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-daily-task-statistics-parameter-cursor"></a>[`cursor`](#list-daily-task-statistics-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-daily-task-statistics-parameter-sort"></a>[`sort`](#list-daily-task-statistics-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

**Parameter: `dateAfter`**

Schema: `string` (`date`) or `string` (`date-time`). Example: `"2026-06-30"`.

<details>
<summary>Schema definition</summary>

```json
{
  "anyOf": [
    {
      "type": "string",
      "format": "date"
    },
    {
      "type": "string",
      "format": "date-time"
    }
  ],
  "example": "2026-06-30"
}
```

</details>

**Parameter: `dateBefore`**

Schema: `string` (`date`) or `string` (`date-time`). Example: `"2026-06-30"`.

<details>
<summary>Schema definition</summary>

```json
{
  "anyOf": [
    {
      "type": "string",
      "format": "date"
    },
    {
      "type": "string",
      "format": "date-time"
    }
  ],
  "example": "2026-06-30"
}
```

</details>

<details id="operation-18-response-200">
<summary>Response body — 200 OK</summary>

A page of daily task statistics ordered by date per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_TaskStatResponse`](#schema-PageResponse_TaskStatResponse). 

**Example response**

```json
{
  "items": [
    {
      "date": "2026-06-30T00:00:00Z",
      "projectName": "myapp",
      "target": "build",
      "isCI": true,
      "totalCount": 100,
      "cacheStatusRatio": {
        "localCacheHit": 0.1,
        "remoteCacheHit": 0.7,
        "cacheMiss": 0.2
      },
      "averageDuration": {
        "localCacheHitMs": 5,
        "remoteCacheHitMs": 120,
        "cacheMissMs": 60000
      },
      "statusCodeRatio": {
        "zero": 0.98,
        "nonZero": 0.02
      },
      "durationPercentiles": [
        {
          "percentile": 50,
          "cacheMissMs": 55000
        },
        {
          "percentile": 95,
          "cacheMissMs": 90000
        }
      ]
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_TaskStatResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-31 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-flaky-task-metrics"></a>

### List flaky-task metrics

`GET` `/nx-cloud/data/v1/flaky-tasks`

List daily flaky-task metric windows for the workspace. Each window groups CI
cache-miss observations by Nx project, target, configuration, and cacheability.
CI runs can contribute with or without distributed execution; local runs do not.
Here, success means exit code 0, and failure means any nonzero exit code.
`flakinessRate` is the fraction of successful observations whose task input hash
also has failures within the same window. `sampleSizeFlakinessRate` counts all
successful cache-miss observations and is the denominator, not the number of runs.
Windows without successful observations are excluded. Zero-rate windows can appear
unless `minFlakinessRate` excludes them. `deflakedAutomatically` counts each task
input hash once per Nx execution with both successful and failed cache-miss attempts;
it does not establish attempt order or a successful final attempt. Attempts without
an execution identifier can also contribute and do not confirm a shared execution.
A `target` filter requires `project`. A `configuration` filter requires `project`
and `target`. `windowStartAfter` and `windowEndBefore` accept an ISO-8601 date
(2026-06-30) or timestamp and bound inclusive whole UTC days. The current UTC day's
values can change until the day ends; set `windowEndBefore` to the previous UTC day
to exclude today's window. Use `links.executions` to access the paginated
contributing distributed executions for each metric, not only those with mixed results.
Observations without an execution identifier can affect metrics, but do not appear
in the executions list.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-flaky-task-metrics-parameter-project"></a>[`project`](#list-flaky-task-metrics-parameter-project) | query | `string` | Match the Nx project name. |
| <a id="list-flaky-task-metrics-parameter-target"></a>[`target`](#list-flaky-task-metrics-parameter-target) | query | `string` | Match the Nx target name. Requires project. |
| <a id="list-flaky-task-metrics-parameter-configuration"></a>[`configuration`](#list-flaky-task-metrics-parameter-configuration) | query | `string` | Match the Nx target configuration. Requires both project and target. |
| <a id="list-flaky-task-metrics-parameter-iscacheable"></a>[`isCacheable`](#list-flaky-task-metrics-parameter-iscacheable) | query | `boolean` | Select metric windows for tasks marked cacheable (true) or non-cacheable (false). Omit to include both and windows with unknown cacheability. Example: `true`. |
| <a id="list-flaky-task-metrics-parameter-windowstartafter"></a>[`windowStartAfter`](#list-flaky-task-metrics-parameter-windowstartafter) | query | `string` (`date`) or `string` (`date-time`) | Inclusive first UTC day. Accepts an ISO-8601 date or timestamp; timestamps select their containing UTC day. Example: `"2026-06-30"`. |
| <a id="list-flaky-task-metrics-parameter-windowendbefore"></a>[`windowEndBefore`](#list-flaky-task-metrics-parameter-windowendbefore) | query | `string` (`date`) or `string` (`date-time`) | Inclusive last UTC day. Accepts an ISO-8601 date or timestamp. Use the previous UTC day to exclude today's mutable window. Example: `"2026-06-30"`. |
| <a id="list-flaky-task-metrics-parameter-minflakinessrate"></a>[`minFlakinessRate`](#list-flaky-task-metrics-parameter-minflakinessrate) | query | `number` (`double`) | Inclusive minimum flakinessRate, as a fraction from 0 to 1. Omit or use 0 to include zero-rate windows with successful cache-miss observations. minimum: `0`. maximum: `1`. |
| <a id="list-flaky-task-metrics-parameter-limit"></a>[`limit`](#list-flaky-task-metrics-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-flaky-task-metrics-parameter-cursor"></a>[`cursor`](#list-flaky-task-metrics-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-flaky-task-metrics-parameter-sort"></a>[`sort`](#list-flaky-task-metrics-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

**Parameter: `windowStartAfter`**

Schema: `string` (`date`) or `string` (`date-time`). Example: `"2026-06-30"`.

<details>
<summary>Schema definition</summary>

```json
{
  "anyOf": [
    {
      "type": "string",
      "format": "date"
    },
    {
      "type": "string",
      "format": "date-time"
    }
  ],
  "example": "2026-06-30"
}
```

</details>

**Parameter: `windowEndBefore`**

Schema: `string` (`date`) or `string` (`date-time`). Example: `"2026-06-30"`.

<details>
<summary>Schema definition</summary>

```json
{
  "anyOf": [
    {
      "type": "string",
      "format": "date"
    },
    {
      "type": "string",
      "format": "date-time"
    }
  ],
  "example": "2026-06-30"
}
```

</details>

<details id="operation-19-response-200">
<summary>Response body — 200 OK</summary>

A page of flaky-task metric windows ordered by windowStart per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_FlakyTaskResponse`](#schema-PageResponse_FlakyTaskResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "686280000000000000000003",
      "project": "myapp",
      "target": "test",
      "windowStart": "2026-06-30T00:00:00Z",
      "windowEnd": "2026-07-01T00:00:00Z",
      "flakinessRate": 0.1,
      "sampleSizeFlakinessRate": 20,
      "totalReruns": 2,
      "deflakedAutomatically": 1,
      "isCacheable": true,
      "links": {
        "executions": "/nx-cloud/data/v1/flaky-tasks/686280000000000000000003/executions"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_FlakyTaskResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-32 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-a-flaky-task-metrics-executions"></a>

### List a flaky-task metric's executions

`GET` `/nx-cloud/data/v1/flaky-tasks/{metricId}/executions`

List the distinct distributed Nx executions that contributed CI cache-miss
observations to one flaky-task metric window, including executions without mixed
results. Observations without an execution identifier, including non-distributed
CI runs, can affect the metric but do not appear in this list. Follow `links.run`
for a run or `links.tasks` for its matching task rows.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-a-flaky-task-metrics-executions-parameter-metricid"></a>[`metricId`](#list-a-flaky-task-metrics-executions-parameter-metricid) (required) | path | `string` | The flaky-task metric's 24-character hexadecimal public identifier, returned as id by listFlakyTasks. |
| <a id="list-a-flaky-task-metrics-executions-parameter-limit"></a>[`limit`](#list-a-flaky-task-metrics-executions-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-a-flaky-task-metrics-executions-parameter-cursor"></a>[`cursor`](#list-a-flaky-task-metrics-executions-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-a-flaky-task-metrics-executions-parameter-sort"></a>[`sort`](#list-a-flaky-task-metrics-executions-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-20-response-200">
<summary>Response body — 200 OK</summary>

A page of contributing executions ordered by their latest observation time per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_FlakyTaskExecutionResponse`](#schema-PageResponse_FlakyTaskExecutionResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "run-build-42",
      "createdAt": "2026-06-30T12:00:00Z",
      "links": {
        "run": "/nx-cloud/data/v1/runs/run-build-42",
        "tasks": "/nx-cloud/data/v1/runs/run-build-42/tasks?taskId=myapp%3Atest"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_FlakyTaskExecutionResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-33 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-34 "404 Not Found") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="list-self-healing-fixes"></a>

### List Self-Healing fixes

`GET` `/nx-cloud/data/v1/self-healing-fixes`

List the Self-Healing CI fix records of one CI pipeline execution (`cipeId`) or one
run group (`runGroup`). One of the two filters is required. A pipeline normally has
at most one fix, created for one of its run groups.
A fix is listed as soon as it is created, while its pipeline may still be running,
and it keeps changing after the pipeline finishes: `suggestedFixStatus` follows the
generation of the change, `verificationStatus` the re-run of tasks with the change
applied, and `userAction` what was done with it. An empty page means no fix was
created; the CIPE's `selfHealingSkip` says why when that was recorded.
List items never carry the patch (`suggestedFix`); fetch a fix by id for it.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="list-self-healing-fixes-parameter-cipeid"></a>[`cipeId`](#list-self-healing-fixes-parameter-cipeid) | query | `string` | Select the fixes of one CI pipeline execution by its id: 24 hexadecimal characters, not ciExecutionId. An unknown CIPE returns 404. Fixes recorded without a CIPE id are not matched; select those with runGroup. |
| <a id="list-self-healing-fixes-parameter-rungroup"></a>[`runGroup`](#list-self-healing-fixes-parameter-rungroup) | query | `string` | Select the fixes of one run group by its id. An unknown run group returns 404. |
| <a id="list-self-healing-fixes-parameter-limit"></a>[`limit`](#list-self-healing-fixes-parameter-limit) | query | `integer` (`int32`) | Rows per page, 1..500 (default 100). Default: `100`. minimum: `1`. maximum: `500`. Example: `100`. |
| <a id="list-self-healing-fixes-parameter-cursor"></a>[`cursor`](#list-self-healing-fixes-parameter-cursor) | query | `string` | Opaque cursor from a previous page's `nextCursor`/`prevCursor`. |
| <a id="list-self-healing-fixes-parameter-sort"></a>[`sort`](#list-self-healing-fixes-parameter-sort) | query | `string` | `ASC` or `DESC` (default), case-insensitive. First request only; a cursor carries its own direction and sort. Allowed: `ASC`, `DESC`. Default: `"DESC"`. Example: `"DESC"`. |

<details id="operation-21-response-200">
<summary>Response body — 200 OK</summary>

A page of fixes ordered by `createdAt` per the request's sort.

Content type: `application/json`.

Schema: [`PageResponse_SelfHealingFixResponse`](#schema-PageResponse_SelfHealingFixResponse). 

**Example response**

```json
{
  "items": [
    {
      "id": "686280000000000000000004",
      "createdAt": "2026-06-30T12:00:00Z",
      "updatedAt": "2026-06-30T12:01:00Z",
      "cipeId": "686280000000000000000001",
      "ciExecutionId": "build-42",
      "runGroup": "ci-build-42",
      "suggestedFixStatus": "COMPLETED",
      "verificationStatus": "COMPLETED",
      "failureClassification": "code_change",
      "suggestedFixDescription": "Update the expected title in the app spec",
      "suggestedFixReasoning": "The spec still asserts the old page title.",
      "suggestedAt": "2026-06-30T12:01:00Z",
      "verifiedAt": "2026-06-30T12:01:00Z",
      "userAction": "NONE",
      "branchIsOutdated": false,
      "fixTasks": [
        {
          "taskId": "myapp:test",
          "runId": "run-build-42",
          "links": {
            "task": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Atest",
            "run": "/nx-cloud/data/v1/runs/run-build-42"
          }
        }
      ],
      "fixedTasks": [
        "myapp:test"
      ],
      "verificationTasksExecuted": [
        "myapp:test"
      ],
      "shortLink": "aB3x-Qz9k",
      "links": {
        "self": "/nx-cloud/data/v1/self-healing-fixes/686280000000000000000004",
        "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
        "cipe": "/nx-cloud/data/v1/cipes/686280000000000000000001"
      }
    }
  ],
  "nextCursor": null,
  "prevCursor": null
}
```

[View field definitions](#schema-PageResponse_SelfHealingFixResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-35 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-36 "404 Not Found") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="get-a-self-healing-fix"></a>

### Get a Self-Healing fix

`GET` `/nx-cloud/data/v1/self-healing-fixes/{fixId}`

Fetch one Self-Healing CI fix by id, in any state. Same shape as a list item, plus
the patch in `suggestedFix` once a change has been suggested.

**Parameters**

| Name | Location | Type | Description |
| --- | --- | --- | --- |
| <a id="get-a-self-healing-fix-parameter-fixid"></a>[`fixId`](#get-a-self-healing-fix-parameter-fixid) (required) | path | `string` | The fix's id: 24 hexadecimal characters, returned as id by listSelfHealingFixes. |

<details id="operation-22-response-200">
<summary>Response body — 200 OK</summary>

The fix.

Content type: `application/json`.

Schema: [`SelfHealingFixResponse`](#schema-SelfHealingFixResponse). 

**Example response**

```json
{
  "id": "686280000000000000000004",
  "createdAt": "2026-06-30T12:00:00Z",
  "updatedAt": "2026-06-30T12:01:00Z",
  "cipeId": "686280000000000000000001",
  "ciExecutionId": "build-42",
  "runGroup": "ci-build-42",
  "suggestedFixStatus": "COMPLETED",
  "verificationStatus": "COMPLETED",
  "failureClassification": "code_change",
  "suggestedFixDescription": "Update the expected title in the app spec",
  "suggestedFixReasoning": "The spec still asserts the old page title.",
  "suggestedAt": "2026-06-30T12:01:00Z",
  "verifiedAt": "2026-06-30T12:01:00Z",
  "userAction": "NONE",
  "branchIsOutdated": false,
  "fixTasks": [
    {
      "taskId": "myapp:test",
      "runId": "run-build-42",
      "links": {
        "task": "/nx-cloud/data/v1/runs/run-build-42/tasks/myapp%3Atest",
        "run": "/nx-cloud/data/v1/runs/run-build-42"
      }
    }
  ],
  "fixedTasks": [
    "myapp:test"
  ],
  "verificationTasksExecuted": [
    "myapp:test"
  ],
  "shortLink": "aB3x-Qz9k",
  "links": {
    "self": "/nx-cloud/data/v1/self-healing-fixes/686280000000000000000004",
    "runGroup": "/nx-cloud/data/v1/run-groups/ci-build-42",
    "cipe": "/nx-cloud/data/v1/cipes/686280000000000000000001"
  }
}
```

[View field definitions](#schema-SelfHealingFixResponse)

Response headers: [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

</details>

Other response codes: [`400`](#http-response-5 "400 Bad Request") • [`401`](#http-response-2 "401 Unauthorized") • [`404`](#http-response-37 "404 Not Found") • [`429`](#http-response-3 "429 Too Many Requests") • [`503`](#http-response-4 "503 Service Unavailable")

<a id="http-response-codes"></a>

## HTTP response codes

<a id="http-status-400"></a>

### 400 Bad Request

<a id="http-response-1"></a>

Invalid limit, cursor, timestamp, date range, or status.

<a id="http-response-5"></a>

A path parameter was malformed or invalid for this entity's id format.

<a id="http-response-8"></a>

Invalid limit, cursor, cipeId, status, or createdAt window.

<a id="http-response-12"></a>

Invalid limit, cursor, or filter.

<a id="http-response-18"></a>

An unknown asset type, or a malformed path/query parameter.

<a id="http-response-23"></a>

Invalid limit, cursor, status, filter, or createdAt window.

<a id="http-response-27"></a>

Invalid limit, cursor, status, or startedAt window.

<a id="http-response-31"></a>

Invalid limit, cursor, filter combination, or date window.

<a id="http-response-32"></a>

Invalid limit, cursor, filter combination, rate, or window.

<a id="http-response-33"></a>

Invalid metric id, limit, or cursor.

<a id="http-response-35"></a>

Neither cipeId nor runGroup was given, or an invalid id, limit or cursor.

Content type: `application/json`.

Schema: [`ErrorResponse`](#schema-ErrorResponse). 

[View field definitions](#schema-ErrorResponse)

<a id="http-status-401"></a>

### 401 Unauthorized

<a id="http-response-2"></a>

The credentials are missing or invalid, or the request uses an unsupported access method.
Authentication failures return plain text. Authorization failures return a JSON error body.

<a id="http-status-404"></a>

### 404 Not Found

<a id="http-response-6"></a>

No CIPE with that id in this workspace.

<a id="http-response-9"></a>

No CIPE with the filtered `cipeId` in this workspace.

<a id="http-response-10"></a>

No run group with that id in this workspace.

<a id="http-response-13"></a>

No such run group or Nx managed agent workflow.

<a id="http-response-15"></a>

No such run group, workflow, or step.

<a id="http-response-16"></a>

No such run group, workflow, step, or Nx managed agent.

<a id="http-response-17"></a>

No such run group, workflow, or instance.

<a id="http-response-19"></a>

No such run group, workflow, instance, prior run, or log location.

<a id="http-response-20"></a>

No such run group in this workspace.

<a id="http-response-21"></a>

No such run group or agent.

<a id="http-response-22"></a>

No such run group or agent, no prior boot at that `boot` index, or the selected
record has no report.

<a id="http-response-24"></a>

No run group with the filtered `runGroup` id in this workspace.

<a id="http-response-25"></a>

No run with that id in this workspace.

<a id="http-response-28"></a>

No such run, or no task with that id (and batchId, if given) in the run.

<a id="http-response-30"></a>

No such run or task, or the task has no asset of that type.

<a id="http-response-34"></a>

No such flaky-task metric in the workspace.

<a id="http-response-36"></a>

No CIPE or run group with that id in this workspace.

<a id="http-response-37"></a>

No fix with that id in this workspace.

Content type: `application/json`.

Schema: [`ErrorResponse`](#schema-ErrorResponse). 

[View field definitions](#schema-ErrorResponse)

<a id="http-status-409"></a>

### 409 Conflict

<a id="http-response-7"></a>

The CIPE is still running (`entityStatus` NOT_STARTED or IN_PROGRESS). `links.runGroups`
lists its run groups so far, running ones included.

<a id="http-response-11"></a>

The run group or its linked workflow is still running. `links.runs` lists the run group's finished runs.

<a id="http-response-14"></a>

The run group or its Nx managed agent workflow is still running; steps, instances and agents
are served once both finish. `links.runs` lists the run group's finished runs.

<a id="http-response-26"></a>

The run is in a non-terminal state (in-progress); only terminal runs are queryable. Retry once
it finishes.

<a id="http-response-29"></a>

The run or task is in a non-terminal state (in-progress); only terminal entities are queryable.
Retry once it finishes.

Content type: `application/json`.

Schema: [`NotTerminalErrorResponse`](#schema-NotTerminalErrorResponse). 

[View field definitions](#schema-NotTerminalErrorResponse)

<a id="http-status-429"></a>

### 429 Too Many Requests

<a id="http-response-3"></a>

The organization's Nx Cloud Public API quota is exhausted (`rate_limit_exceeded`). Every
workspace and access token in the organization shares one quota, and each request costs
one unit. By default, Free organizations get 30
requests/minute with bursts of up to 10. Team, Pro, and OSS
organizations get 60 requests/minute with bursts of up to
10. Enterprise organizations get
2500 requests/minute with bursts of up to
500. The global
API rate limit can also return 429, with an empty body. Wait `Retry-After` seconds before retrying.

Content type: `application/json`.

Schema: [`ErrorResponse`](#schema-ErrorResponse). 

[View field definitions](#schema-ErrorResponse)

Response headers: [`Retry-After`](#response-header-3), [`RateLimit-Policy`](#response-header-1), [`RateLimit`](#response-header-2).

<a id="http-status-503"></a>

### 503 Service Unavailable

<a id="http-response-4"></a>

The Nx Cloud Public API is temporarily at capacity (`data_api_at_capacity`), could not
complete the request in time (`query_deadline_exceeded`), could not persist
its required audit record (`audit_log_unavailable`), or could not check the organization's
quota (`rate_limit_unavailable`). No data is returned. Retry per the `Retry-After` header.

Content type: `application/json`.

Schema: [`ErrorResponse`](#schema-ErrorResponse). 

[View field definitions](#schema-ErrorResponse)

Response headers: [`Retry-After`](#response-header-4).

<a id="response-headers"></a>

### Response headers

<a id="http-header-ratelimit-policy"></a>

#### RateLimit-Policy

Type: `string`. 

<a id="response-header-1"></a>

Documented with HTTP `200`, `302`, `429`.

The organization's quota: `q` requests per `w` seconds, for example `"organization";q=10;w=10`.

<a id="http-header-ratelimit"></a>

#### RateLimit

Type: `string`. 

<a id="response-header-2"></a>

Documented with HTTP `200`, `302`, `429`.

`r` requests remain now, and the quota is full again in `t` seconds, for example `"organization";r=7;t=3`.

<a id="http-header-retry-after"></a>

#### Retry-After

Type: `string`. 

<a id="response-header-3"></a>

Documented with HTTP `429`.

Seconds until the next request is allowed.

<a id="response-header-4"></a>

Documented with HTTP `503`.

Minimum seconds to wait before retrying (server-randomized). Treat it as a floor
and apply exponential backoff on repeated 503s.

<a id="schemas"></a>

## Schema and field definitions

<a id="schema-CipeResponse"></a>

### CipeResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-ciperesponse-property-id"></a>[`id`](#schema-ciperesponse-property-id) (required) | `string` | The CI pipeline execution identifier: 24 hexadecimal characters. Use this id in CIPE paths and cipeId filters, not ciExecutionId. |
| <a id="schema-ciperesponse-property-status"></a>[`status`](#schema-ciperesponse-property-status) (required) | `string` | The pipeline status: NOT_STARTED, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED or TIMED_OUT. |
| <a id="schema-ciperesponse-property-createdat"></a>[`createdAt`](#schema-ciperesponse-property-createdat) (required) | `string` (`date-time`) | The pipeline creation time, in UTC. |
| <a id="schema-ciperesponse-property-updatedat"></a>[`updatedAt`](#schema-ciperesponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when unavailable. |
| <a id="schema-ciperesponse-property-completedat"></a>[`completedAt`](#schema-ciperesponse-property-completedat) | `null` or `string` (`date-time`) | The recorded completion time, in UTC; absent when unavailable, even for a terminal pipeline. |
| <a id="schema-ciperesponse-property-workspaceid"></a>[`workspaceId`](#schema-ciperesponse-property-workspaceid) (required) | `string` | The workspace identifier: 24 hexadecimal characters. It identifies the workspace that owns this CI pipeline execution. |
| <a id="schema-ciperesponse-property-ciexecutionid"></a>[`ciExecutionId`](#schema-ciperesponse-property-ciexecutionid) (required) | `string` | The execution identifier supplied by the CI integration. Use id, not this value, in CIPE paths and cipeId filters. |
| <a id="schema-ciperesponse-property-branch"></a>[`branch`](#schema-ciperesponse-property-branch) | `null` or `string` | The recorded branch name; absent when not supplied. |
| <a id="schema-ciperesponse-property-vcscontext"></a>[`vcsContext`](#schema-ciperesponse-property-vcscontext) | `null` or [`VcsContextResponse`](#schema-VcsContextResponse) | Recorded version-control metadata; absent when not supplied. |
| <a id="schema-ciperesponse-property-cancellationrequest"></a>[`cancellationRequest`](#schema-ciperesponse-property-cancellationrequest) | `null` or [`CipeCancellationRequestResponse`](#schema-CipeCancellationRequestResponse) | The recognized cancellation request, if recorded. Its absence does not prove that no cancellation occurred. |
| <a id="schema-ciperesponse-property-selfhealingskip"></a>[`selfHealingSkip`](#schema-ciperesponse-property-selfhealingskip) | `null` or [`SelfHealingSkipResponse`](#schema-SelfHealingSkipResponse) | Why self-healing work was skipped, if recorded. |
| <a id="schema-ciperesponse-property-rungroups"></a>[`runGroups`](#schema-ciperesponse-property-rungroups) (required) | [`ChildCollectionSummary`](#schema-ChildCollectionSummary) | Counts for all related run groups without optional filters. While the CIPE runs, the counts are the run groups it has so far and can still change. Follow links.runGroups for their records. |
| <a id="schema-ciperesponse-property-links"></a>[`links`](#schema-ciperesponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self addresses this CIPE; runGroups lists its run groups; selfHealingFixes lists its Self-Healing fixes, which is an empty page when it has none. While the CIPE runs, self returns 409 and runGroups lists the run groups it has so far, running ones included. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The CI pipeline execution identifier: 24 hexadecimal characters. Use this id in CIPE paths and cipeId filters, not ciExecutionId.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The pipeline status: NOT_STARTED, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED or TIMED_OUT.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The pipeline creation time, in UTC.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded completion time, in UTC; absent when unavailable, even for a terminal pipeline.",
      "title": "String"
    },
    "workspaceId": {
      "type": "string",
      "description": "The workspace identifier: 24 hexadecimal characters. It identifies the workspace that owns this CI pipeline execution.",
      "title": "String"
    },
    "ciExecutionId": {
      "type": "string",
      "description": "The execution identifier supplied by the CI integration. Use id, not this value, in CIPE paths and cipeId filters.",
      "title": "String"
    },
    "branch": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded branch name; absent when not supplied.",
      "title": "String"
    },
    "vcsContext": {
      "description": "Recorded version-control metadata; absent when not supplied.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/VcsContextResponse"
        }
      ]
    },
    "cancellationRequest": {
      "description": "The recognized cancellation request, if recorded. Its absence does not prove that no cancellation occurred.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/CipeCancellationRequestResponse"
        }
      ]
    },
    "selfHealingSkip": {
      "description": "Why self-healing work was skipped, if recorded.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/SelfHealingSkipResponse"
        }
      ]
    },
    "runGroups": {
      "$ref": "#/components/schemas/ChildCollectionSummary",
      "description": "Counts for all related run groups without optional filters. While the CIPE runs, the counts are the run groups it has so far and can still change. Follow links.runGroups for their records."
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self addresses this CIPE; runGroups lists its run groups; selfHealingFixes lists its Self-Healing fixes, which is an empty page when it has none. While the CIPE runs, self returns 409 and runGroups lists the run groups it has so far, running ones included.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "ciExecutionId",
    "createdAt",
    "id",
    "links",
    "runGroups",
    "status",
    "workspaceId"
  ],
  "title": "CipeResponse"
}
```

</details>

<a id="schema-VcsContextResponse"></a>

### VcsContextResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-vcscontextresponse-property-branch"></a>[`branch`](#schema-vcscontextresponse-property-branch) (required) | `string` | The branch reported by the version-control integration. |
| <a id="schema-vcscontextresponse-property-ref"></a>[`ref`](#schema-vcscontextresponse-property-ref) | `null` or `string` | The recorded version-control ref; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-title"></a>[`title`](#schema-vcscontextresponse-property-title) | `null` or `string` | The first line of the commit or pull request title; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-headsha"></a>[`headSha`](#schema-vcscontextresponse-property-headsha) | `null` or `string` | The recorded head commit SHA; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-basesha"></a>[`baseSha`](#schema-vcscontextresponse-property-basesha) | `null` or `string` | The recorded base commit SHA; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-author"></a>[`author`](#schema-vcscontextresponse-property-author) | `null` or `string` | The author reported by the integration; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-platformname"></a>[`platformName`](#schema-vcscontextresponse-property-platformname) | `null` or `string` | The version-control platform name; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-runnerprovider"></a>[`runnerProvider`](#schema-vcscontextresponse-property-runnerprovider) | `null` or [`RunnerProvider`](#schema-RunnerProvider) | The recorded CI runner provider; absent when unavailable. |
| <a id="schema-vcscontextresponse-property-isfork"></a>[`isFork`](#schema-vcscontextresponse-property-isfork) | `null` or `boolean` | Whether the integration identified a fork. Absence means unknown, not false. |
| <a id="schema-vcscontextresponse-property-isdraft"></a>[`isDraft`](#schema-vcscontextresponse-property-isdraft) | `null` or `boolean` | Whether the integration identified a draft pull request. Absence means unknown, not false. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "branch": {
      "type": "string",
      "description": "The branch reported by the version-control integration.",
      "title": "String"
    },
    "ref": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded version-control ref; absent when unavailable.",
      "title": "String"
    },
    "title": {
      "type": [
        "null",
        "string"
      ],
      "description": "The first line of the commit or pull request title; absent when unavailable.",
      "title": "String"
    },
    "headSha": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded head commit SHA; absent when unavailable.",
      "title": "String"
    },
    "baseSha": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded base commit SHA; absent when unavailable.",
      "title": "String"
    },
    "author": {
      "type": [
        "null",
        "string"
      ],
      "description": "The author reported by the integration; absent when unavailable.",
      "title": "String"
    },
    "platformName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The version-control platform name; absent when unavailable.",
      "title": "String"
    },
    "runnerProvider": {
      "description": "The recorded CI runner provider; absent when unavailable.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/RunnerProvider"
        }
      ]
    },
    "isFork": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether the integration identified a fork. Absence means unknown, not false.",
      "title": "Boolean"
    },
    "isDraft": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether the integration identified a draft pull request. Absence means unknown, not false.",
      "title": "Boolean"
    }
  },
  "required": [
    "branch"
  ],
  "title": "VcsContextResponse"
}
```

</details>

<a id="schema-RunnerProvider"></a>

### RunnerProvider

Type: `string`. Allowed: `GITHUB`, `SELF_HOSTED`, `DEPOT`, `BLACKSMITH`, `WARPBUILD`, `RUNS_ON`, `NAMESPACE`.

<details>
<summary>Schema definition</summary>

```json
{
  "type": "string",
  "enum": [
    "GITHUB",
    "SELF_HOSTED",
    "DEPOT",
    "BLACKSMITH",
    "WARPBUILD",
    "RUNS_ON",
    "NAMESPACE"
  ],
  "title": "RunnerProvider"
}
```

</details>

<a id="schema-CipeCancellationRequestResponse"></a>

### CipeCancellationRequestResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-cipecancellationrequestresponse-property-source"></a>[`source`](#schema-cipecancellationrequestresponse-property-source) (required) | `string` | The cancellation source: CANCELLED_BY_USER or NEW_CIPE_PUSHED. |
| <a id="schema-cipecancellationrequestresponse-property-actor"></a>[`actor`](#schema-cipecancellationrequestresponse-property-actor) (required) | `string` | The actor category: user for a user request, or system for a newer CIPE. Not a user identifier. |
| <a id="schema-cipecancellationrequestresponse-property-requestedat"></a>[`requestedAt`](#schema-cipecancellationrequestresponse-property-requestedat) (required) | `string` (`date-time`) | When the cancellation was requested, in UTC. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "source": {
      "type": "string",
      "description": "The cancellation source: CANCELLED_BY_USER or NEW_CIPE_PUSHED.",
      "title": "String"
    },
    "actor": {
      "type": "string",
      "description": "The actor category: user for a user request, or system for a newer CIPE. Not a user identifier.",
      "title": "String"
    },
    "requestedAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the cancellation was requested, in UTC.",
      "title": "String"
    }
  },
  "required": [
    "actor",
    "requestedAt",
    "source"
  ],
  "title": "CipeCancellationRequestResponse"
}
```

</details>

<a id="schema-SelfHealingSkipResponse"></a>

### SelfHealingSkipResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-selfhealingskipresponse-property-reason"></a>[`reason`](#schema-selfhealingskipresponse-property-reason) (required) | `string` | The recorded reason code for skipping self-healing. |
| <a id="schema-selfhealingskipresponse-property-message"></a>[`message`](#schema-selfhealingskipresponse-property-message) (required) | `string` | A human-readable explanation of the skip reason. |
| <a id="schema-selfhealingskipresponse-property-recordedat"></a>[`recordedAt`](#schema-selfhealingskipresponse-property-recordedat) (required) | `string` (`date-time`) | When the skip decision was recorded, in UTC. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "description": "The recorded reason code for skipping self-healing.",
      "title": "String"
    },
    "message": {
      "type": "string",
      "description": "A human-readable explanation of the skip reason.",
      "title": "String"
    },
    "recordedAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the skip decision was recorded, in UTC.",
      "title": "String"
    }
  },
  "required": [
    "message",
    "reason",
    "recordedAt"
  ],
  "title": "SelfHealingSkipResponse"
}
```

</details>

<a id="schema-ChildCollectionSummary"></a>

### ChildCollectionSummary

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-childcollectionsummary-property-total"></a>[`total`](#schema-childcollectionsummary-property-total) (required) | `integer` (`int32`) | The number of records in the related collection before optional filters. |
| <a id="schema-childcollectionsummary-property-statuscounts"></a>[`statusCounts`](#schema-childcollectionsummary-property-statuscounts) (required) | Dictionary of `integer` (`int32`) | Counts keyed by public statuses present in the collection. Statuses with no records are absent. Counts sum to total. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "total": {
      "type": "integer",
      "format": "int32",
      "description": "The number of records in the related collection before optional filters.",
      "title": "Int"
    },
    "statusCounts": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "format": "int32",
        "title": "Int"
      },
      "description": "Counts keyed by public statuses present in the collection. Statuses with no records are absent. Counts sum to total.",
      "title": "LinkedHashMap_String-Int"
    }
  },
  "required": [
    "statusCounts",
    "total"
  ],
  "title": "ChildCollectionSummary"
}
```

</details>

<a id="schema-PageResponse_CipeResponse"></a>

### PageResponse_CipeResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_ciperesponse-property-items"></a>[`items`](#schema-pageresponse_ciperesponse-property-items) (required) | [`CipeResponse[]`](#schema-CipeResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_ciperesponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_ciperesponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_ciperesponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_ciperesponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/CipeResponse"
      },
      "title": "ArrayList_CipeResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_CipeResponse"
}
```

</details>

<a id="schema-ErrorResponse"></a>

### ErrorResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-errorresponse-property-error"></a>[`error`](#schema-errorresponse-property-error) (required) | `string` | The HTTP status description, such as Not Found. Clients should use the HTTP status and code, not this text, to identify a failure. |
| <a id="schema-errorresponse-property-message"></a>[`message`](#schema-errorresponse-property-message) (required) | `string` | A human-readable explanation. Do not use this text as a stable error identifier. |
| <a id="schema-errorresponse-property-traceid"></a>[`traceId`](#schema-errorresponse-property-traceid) | `null` or `string` | The request trace identifier, when available, for support and diagnostics. |
| <a id="schema-errorresponse-property-code"></a>[`code`](#schema-errorresponse-property-code) | `null` or `string` | The machine-readable error code, when available. Use it to distinguish failures within an HTTP status. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "description": "The HTTP status description, such as Not Found. Clients should use the HTTP status and code, not this text, to identify a failure.",
      "title": "String"
    },
    "message": {
      "type": "string",
      "description": "A human-readable explanation. Do not use this text as a stable error identifier.",
      "title": "String"
    },
    "traceId": {
      "type": [
        "null",
        "string"
      ],
      "description": "The request trace identifier, when available, for support and diagnostics.",
      "title": "String"
    },
    "code": {
      "type": [
        "null",
        "string"
      ],
      "description": "The machine-readable error code, when available. Use it to distinguish failures within an HTTP status.",
      "title": "String"
    }
  },
  "required": [
    "error",
    "message"
  ],
  "title": "ErrorResponse"
}
```

</details>

<a id="schema-NotTerminalErrorResponse"></a>

### NotTerminalErrorResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-notterminalerrorresponse-property-error"></a>[`error`](#schema-notterminalerrorresponse-property-error) (required) | `string` | The HTTP status description, Conflict. |
| <a id="schema-notterminalerrorresponse-property-message"></a>[`message`](#schema-notterminalerrorresponse-property-message) (required) | `string` | A human-readable explanation. Do not use this text as a stable error identifier. |
| <a id="schema-notterminalerrorresponse-property-traceid"></a>[`traceId`](#schema-notterminalerrorresponse-property-traceid) | `null` or `string` | The request trace identifier, when available, for support and diagnostics. |
| <a id="schema-notterminalerrorresponse-property-code"></a>[`code`](#schema-notterminalerrorresponse-property-code) (required) | `string` | The machine-readable error code: not_terminal. |
| <a id="schema-notterminalerrorresponse-property-entitystatus"></a>[`entityStatus`](#schema-notterminalerrorresponse-property-entitystatus) (required) | `string` | The entity's current, non-terminal status, such as IN_PROGRESS or NOT_STARTED. Not the HTTP status. |
| <a id="schema-notterminalerrorresponse-property-links"></a>[`links`](#schema-notterminalerrorresponse-property-links) | Dictionary of `string` | Relative GET URLs one level down: runGroups for a CIPE, runs for a run group. Those lists serve the children that exist now. Empty for a run or task. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "description": "The HTTP status description, Conflict.",
      "title": "String"
    },
    "message": {
      "type": "string",
      "description": "A human-readable explanation. Do not use this text as a stable error identifier.",
      "title": "String"
    },
    "traceId": {
      "type": [
        "null",
        "string"
      ],
      "description": "The request trace identifier, when available, for support and diagnostics.",
      "title": "String"
    },
    "code": {
      "type": "string",
      "description": "The machine-readable error code: not_terminal.",
      "title": "String"
    },
    "entityStatus": {
      "type": "string",
      "description": "The entity's current, non-terminal status, such as IN_PROGRESS or NOT_STARTED. Not the HTTP status.",
      "title": "String"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs one level down: runGroups for a CIPE, runs for a run group. Those lists serve the children that exist now. Empty for a run or task.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "code",
    "entityStatus",
    "error",
    "message"
  ],
  "title": "NotTerminalErrorResponse"
}
```

</details>

<a id="schema-RunGroupListResponse"></a>

### RunGroupListResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-rungrouplistresponse-property-id"></a>[`id`](#schema-rungrouplistresponse-property-id) (required) | `string` | The run-group identifier. Treat it as an opaque string, distinct from cipeId. URL-encode the returned value as one path segment. |
| <a id="schema-rungrouplistresponse-property-status"></a>[`status`](#schema-rungrouplistresponse-property-status) (required) | `string` | The run-group status: NOT_STARTED, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED or TIMED_OUT. |
| <a id="schema-rungrouplistresponse-property-createdat"></a>[`createdAt`](#schema-rungrouplistresponse-property-createdat) (required) | `string` (`date-time`) | The run-group creation time, in UTC. List ordering uses the parent CIPE creation time instead. |
| <a id="schema-rungrouplistresponse-property-updatedat"></a>[`updatedAt`](#schema-rungrouplistresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when unavailable. |
| <a id="schema-rungrouplistresponse-property-completedat"></a>[`completedAt`](#schema-rungrouplistresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded completion time, in UTC; absent when unavailable. |
| <a id="schema-rungrouplistresponse-property-cipeid"></a>[`cipeId`](#schema-rungrouplistresponse-property-cipeid) (required) | `string` | The parent CI pipeline execution identifier: 24 hexadecimal characters. Use it in CIPE paths and cipeId filters. |
| <a id="schema-rungrouplistresponse-property-branch"></a>[`branch`](#schema-rungrouplistresponse-property-branch) | `null` or `string` | The recorded branch; absent when unavailable. |
| <a id="schema-rungrouplistresponse-property-ciexecutionenv"></a>[`ciExecutionEnv`](#schema-rungrouplistresponse-property-ciexecutionenv) (required) | `string` | The CI execution environment name. |
| <a id="schema-rungrouplistresponse-property-completedby"></a>[`completedBy`](#schema-rungrouplistresponse-property-completedby) | `null` or `string` | The recorded completion source; absent when unavailable. |
| <a id="schema-rungrouplistresponse-property-criticalerrormessage"></a>[`criticalErrorMessage`](#schema-rungrouplistresponse-property-criticalerrormessage) | `null` or `string` | The recorded critical error explanation; absent when none was recorded. |
| <a id="schema-rungrouplistresponse-property-agentcount"></a>[`agentCount`](#schema-rungrouplistresponse-property-agentcount) | `null` or `integer` (`int32`) | The recorded agent count; absent while the run group runs or when unavailable, not necessarily zero. |
| <a id="schema-rungrouplistresponse-property-commandcount"></a>[`commandCount`](#schema-rungrouplistresponse-property-commandcount) | `null` or `integer` (`int32`) | The recorded command count; absent while the run group runs or when unavailable, not necessarily zero. |
| <a id="schema-rungrouplistresponse-property-links"></a>[`links`](#schema-rungrouplistresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self, cipe, runs, agents, and selfHealingFixes. While the run group runs, agents is absent and self returns 409; runs lists the runs that have finished. selfHealingFixes is an empty page when the run group has no fix. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The run-group identifier. Treat it as an opaque string, distinct from cipeId. URL-encode the returned value as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The run-group status: NOT_STARTED, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED or TIMED_OUT.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The run-group creation time, in UTC. List ordering uses the parent CIPE creation time instead.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "cipeId": {
      "type": "string",
      "description": "The parent CI pipeline execution identifier: 24 hexadecimal characters. Use it in CIPE paths and cipeId filters.",
      "title": "String"
    },
    "branch": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded branch; absent when unavailable.",
      "title": "String"
    },
    "ciExecutionEnv": {
      "type": "string",
      "description": "The CI execution environment name.",
      "title": "String"
    },
    "completedBy": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded completion source; absent when unavailable.",
      "title": "String"
    },
    "criticalErrorMessage": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded critical error explanation; absent when none was recorded.",
      "title": "String"
    },
    "agentCount": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int32",
      "description": "The recorded agent count; absent while the run group runs or when unavailable, not necessarily zero.",
      "title": "Int"
    },
    "commandCount": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int32",
      "description": "The recorded command count; absent while the run group runs or when unavailable, not necessarily zero.",
      "title": "Int"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self, cipe, runs, agents, and selfHealingFixes. While the run group runs, agents is absent and self returns 409; runs lists the runs that have finished. selfHealingFixes is an empty page when the run group has no fix.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "ciExecutionEnv",
    "cipeId",
    "createdAt",
    "id",
    "links",
    "status"
  ],
  "title": "RunGroupListResponse"
}
```

</details>

<a id="schema-PageResponse_RunGroupListResponse"></a>

### PageResponse_RunGroupListResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_rungrouplistresponse-property-items"></a>[`items`](#schema-pageresponse_rungrouplistresponse-property-items) (required) | [`RunGroupListResponse[]`](#schema-RunGroupListResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_rungrouplistresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_rungrouplistresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_rungrouplistresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_rungrouplistresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/RunGroupListResponse"
      },
      "title": "ArrayList_RunGroupListResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_RunGroupListResponse"
}
```

</details>

<a id="schema-RunGroupWorkflowResponse"></a>

### RunGroupWorkflowResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-rungroupworkflowresponse-property-type"></a>[`type`](#schema-rungroupworkflowresponse-property-type) (required) | `string` | The recorded managed workflow type. |
| <a id="schema-rungroupworkflowresponse-property-status"></a>[`status`](#schema-rungroupworkflowresponse-property-status) (required) | `string` | The recorded workflow status. |
| <a id="schema-rungroupworkflowresponse-property-createdat"></a>[`createdAt`](#schema-rungroupworkflowresponse-property-createdat) (required) | `string` (`date-time`) | The workflow creation time, in UTC. For older executions, this time may be inferred rather than recorded. |
| <a id="schema-rungroupworkflowresponse-property-updatedat"></a>[`updatedAt`](#schema-rungroupworkflowresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded workflow update time, in UTC; absent when unavailable. |
| <a id="schema-rungroupworkflowresponse-property-completedat"></a>[`completedAt`](#schema-rungroupworkflowresponse-property-completedat) | `null` or `string` (`date-time`) | The terminal workflow's last update time, in UTC; absent when unavailable. |
| <a id="schema-rungroupworkflowresponse-property-steps"></a>[`steps`](#schema-rungroupworkflowresponse-property-steps) (required) | [`ChildCollectionSummary`](#schema-ChildCollectionSummary) | Counts for all workflow steps. Follow links.steps for their records. |
| <a id="schema-rungroupworkflowresponse-property-agents"></a>[`agents`](#schema-rungroupworkflowresponse-property-agents) (required) | [`ChildCollectionSummary`](#schema-ChildCollectionSummary) | Counts for all workflow agent identities. Follow links.agents for their records. |
| <a id="schema-rungroupworkflowresponse-property-instances"></a>[`instances`](#schema-rungroupworkflowresponse-property-instances) (required) | [`InstanceCollectionSummary`](#schema-InstanceCollectionSummary) | Counts for all workflow instances (one step on one agent), including restart counts. Follow links.instances for their records. |
| <a id="schema-rungroupworkflowresponse-property-launchtemplates"></a>[`launchTemplates`](#schema-rungroupworkflowresponse-property-launchtemplates) | `null` or Dictionary of [`LaunchTemplateInfo`](#schema-LaunchTemplateInfo) | A dictionary keyed by launch-template name. Absent when no template metadata or credit estimate exists. |
| <a id="schema-rungroupworkflowresponse-property-estimatedtotalcredits"></a>[`estimatedTotalCredits`](#schema-rungroupworkflowresponse-property-estimatedtotalcredits) | `null` or `integer` (`int64`) | The sum of recorded launch-template credit estimates, in Nx Cloud credits; absent when unavailable. |
| <a id="schema-rungroupworkflowresponse-property-links"></a>[`links`](#schema-rungroupworkflowresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs for the workflow's steps, agents, and instances. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "description": "The recorded managed workflow type.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The recorded workflow status.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The workflow creation time, in UTC. For older executions, this time may be inferred rather than recorded.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded workflow update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The terminal workflow's last update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "steps": {
      "$ref": "#/components/schemas/ChildCollectionSummary",
      "description": "Counts for all workflow steps. Follow links.steps for their records."
    },
    "agents": {
      "$ref": "#/components/schemas/ChildCollectionSummary",
      "description": "Counts for all workflow agent identities. Follow links.agents for their records."
    },
    "instances": {
      "$ref": "#/components/schemas/InstanceCollectionSummary",
      "description": "Counts for all workflow instances (one step on one agent), including restart counts. Follow links.instances for their records."
    },
    "launchTemplates": {
      "type": [
        "null",
        "object"
      ],
      "additionalProperties": {
        "$ref": "#/components/schemas/LaunchTemplateInfo"
      },
      "description": "A dictionary keyed by launch-template name. Absent when no template metadata or credit estimate exists.",
      "title": "LinkedHashMap_String-LaunchTemplateInfo"
    },
    "estimatedTotalCredits": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The sum of recorded launch-template credit estimates, in Nx Cloud credits; absent when unavailable.",
      "title": "Long"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs for the workflow's steps, agents, and instances.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "agents",
    "createdAt",
    "instances",
    "links",
    "status",
    "steps",
    "type"
  ],
  "title": "RunGroupWorkflowResponse"
}
```

</details>

<a id="schema-InstanceCollectionSummary"></a>

### InstanceCollectionSummary

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instancecollectionsummary-property-total"></a>[`total`](#schema-instancecollectionsummary-property-total) (required) | `integer` (`int32`) | The number of workflow instances (one step on one agent) before optional filters, not agent boots. Older executions without agent identities count separately. |
| <a id="schema-instancecollectionsummary-property-statuscounts"></a>[`statusCounts`](#schema-instancecollectionsummary-property-statuscounts) (required) | Dictionary of `integer` (`int32`) | Workflow instance counts keyed by the selected execution's public status. Statuses with no instances are absent. Counts sum to total. |
| <a id="schema-instancecollectionsummary-property-restarted"></a>[`restarted`](#schema-instancecollectionsummary-property-restarted) (required) | `integer` (`int32`) | The number of workflow instances with at least one superseded execution after an agent restart, not the number of restart attempts. |
| <a id="schema-instancecollectionsummary-property-restartattempts"></a>[`restartAttempts`](#schema-instancecollectionsummary-property-restartattempts) (required) | `integer` (`int32`) | The total number of superseded executions across workflow instances, excluding their selected executions. Superseded executions can start after the selected execution. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "total": {
      "type": "integer",
      "format": "int32",
      "description": "The number of workflow instances (one step on one agent) before optional filters, not agent boots. Older executions without agent identities count separately.",
      "title": "Int"
    },
    "statusCounts": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "format": "int32",
        "title": "Int"
      },
      "description": "Workflow instance counts keyed by the selected execution's public status. Statuses with no instances are absent. Counts sum to total.",
      "title": "LinkedHashMap_String-Int"
    },
    "restarted": {
      "type": "integer",
      "format": "int32",
      "description": "The number of workflow instances with at least one superseded execution after an agent restart, not the number of restart attempts.",
      "title": "Int"
    },
    "restartAttempts": {
      "type": "integer",
      "format": "int32",
      "description": "The total number of superseded executions across workflow instances, excluding their selected executions. Superseded executions can start after the selected execution.",
      "title": "Int"
    }
  },
  "required": [
    "restartAttempts",
    "restarted",
    "statusCounts",
    "total"
  ],
  "title": "InstanceCollectionSummary"
}
```

</details>

<a id="schema-LaunchTemplateInfo"></a>

### LaunchTemplateInfo

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-launchtemplateinfo-property-resourceclass"></a>[`resourceClass`](#schema-launchtemplateinfo-property-resourceclass) | `null` or `string` | The recorded resource class for this launch template; absent when unavailable. |
| <a id="schema-launchtemplateinfo-property-estimatedcredits"></a>[`estimatedCredits`](#schema-launchtemplateinfo-property-estimatedcredits) | `null` or `integer` (`int64`) | The recorded compute estimate for this launch template, in Nx Cloud credits; absent when unavailable. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "resourceClass": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded resource class for this launch template; absent when unavailable.",
      "title": "String"
    },
    "estimatedCredits": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The recorded compute estimate for this launch template, in Nx Cloud credits; absent when unavailable.",
      "title": "Long"
    }
  },
  "title": "LaunchTemplateInfo"
}
```

</details>

<a id="schema-RunGroupResponse"></a>

### RunGroupResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-rungroupresponse-property-id"></a>[`id`](#schema-rungroupresponse-property-id) (required) | `string` | The run-group identifier. Treat it as an opaque string, distinct from cipeId. URL-encode the returned value as one path segment. |
| <a id="schema-rungroupresponse-property-status"></a>[`status`](#schema-rungroupresponse-property-status) (required) | `string` | The terminal run-group status: SUCCEEDED, FAILED, CANCELED or TIMED_OUT. A running run group returns 409 here. |
| <a id="schema-rungroupresponse-property-createdat"></a>[`createdAt`](#schema-rungroupresponse-property-createdat) (required) | `string` (`date-time`) | The run-group creation time, in UTC. List ordering uses the parent CIPE creation time instead. |
| <a id="schema-rungroupresponse-property-updatedat"></a>[`updatedAt`](#schema-rungroupresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when unavailable. |
| <a id="schema-rungroupresponse-property-completedat"></a>[`completedAt`](#schema-rungroupresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded completion time, in UTC; absent when unavailable. |
| <a id="schema-rungroupresponse-property-cipeid"></a>[`cipeId`](#schema-rungroupresponse-property-cipeid) (required) | `string` | The parent CI pipeline execution identifier: 24 hexadecimal characters. Use it in CIPE paths and cipeId filters. |
| <a id="schema-rungroupresponse-property-branch"></a>[`branch`](#schema-rungroupresponse-property-branch) | `null` or `string` | The recorded branch; absent when unavailable. |
| <a id="schema-rungroupresponse-property-ciexecutionenv"></a>[`ciExecutionEnv`](#schema-rungroupresponse-property-ciexecutionenv) (required) | `string` | The CI execution environment name. |
| <a id="schema-rungroupresponse-property-completedby"></a>[`completedBy`](#schema-rungroupresponse-property-completedby) | `null` or `string` | The recorded completion source; absent when unavailable. |
| <a id="schema-rungroupresponse-property-criticalerrormessage"></a>[`criticalErrorMessage`](#schema-rungroupresponse-property-criticalerrormessage) | `null` or `string` | The recorded critical error explanation; absent when none was recorded. |
| <a id="schema-rungroupresponse-property-agentcount"></a>[`agentCount`](#schema-rungroupresponse-property-agentcount) | `null` or `integer` (`int32`) | The recorded agent count; absent when unavailable, not necessarily zero. |
| <a id="schema-rungroupresponse-property-commandcount"></a>[`commandCount`](#schema-rungroupresponse-property-commandcount) | `null` or `integer` (`int32`) | The recorded command count; absent when unavailable, not necessarily zero. |
| <a id="schema-rungroupresponse-property-runs"></a>[`runs`](#schema-rungroupresponse-property-runs) (required) | [`ChildCollectionSummary`](#schema-ChildCollectionSummary) | Counts for all related runs without optional filters. Follow links.runs for their records. |
| <a id="schema-rungroupresponse-property-workflow"></a>[`workflow`](#schema-rungroupresponse-property-workflow) | `null` or [`RunGroupWorkflowResponse`](#schema-RunGroupWorkflowResponse) | The Nx managed agent workflow; absent for a run group without one, including BYOC run groups. |
| <a id="schema-rungroupresponse-property-links"></a>[`links`](#schema-rungroupresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self, cipe, runs, agents, and selfHealingFixes. selfHealingFixes is an empty page when the run group has no fix. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The run-group identifier. Treat it as an opaque string, distinct from cipeId. URL-encode the returned value as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The terminal run-group status: SUCCEEDED, FAILED, CANCELED or TIMED_OUT. A running run group returns 409 here.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The run-group creation time, in UTC. List ordering uses the parent CIPE creation time instead.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "cipeId": {
      "type": "string",
      "description": "The parent CI pipeline execution identifier: 24 hexadecimal characters. Use it in CIPE paths and cipeId filters.",
      "title": "String"
    },
    "branch": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded branch; absent when unavailable.",
      "title": "String"
    },
    "ciExecutionEnv": {
      "type": "string",
      "description": "The CI execution environment name.",
      "title": "String"
    },
    "completedBy": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded completion source; absent when unavailable.",
      "title": "String"
    },
    "criticalErrorMessage": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded critical error explanation; absent when none was recorded.",
      "title": "String"
    },
    "agentCount": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int32",
      "description": "The recorded agent count; absent when unavailable, not necessarily zero.",
      "title": "Int"
    },
    "commandCount": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int32",
      "description": "The recorded command count; absent when unavailable, not necessarily zero.",
      "title": "Int"
    },
    "runs": {
      "$ref": "#/components/schemas/ChildCollectionSummary",
      "description": "Counts for all related runs without optional filters. Follow links.runs for their records."
    },
    "workflow": {
      "description": "The Nx managed agent workflow; absent for a run group without one, including BYOC run groups.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/RunGroupWorkflowResponse"
        }
      ]
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self, cipe, runs, agents, and selfHealingFixes. selfHealingFixes is an empty page when the run group has no fix.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "ciExecutionEnv",
    "cipeId",
    "createdAt",
    "id",
    "links",
    "runs",
    "status"
  ],
  "title": "RunGroupResponse"
}
```

</details>

<a id="schema-StepResponse"></a>

### StepResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-stepresponse-property-id"></a>[`id`](#schema-stepresponse-property-id) (required) | `string` | The step identifier within the run group's workflow, not its display name. It can contain colons. URL-encode it as one path segment. |
| <a id="schema-stepresponse-property-status"></a>[`status`](#schema-stepresponse-property-status) (required) | `string` | The workflow step's recorded status, not a live progress state. |
| <a id="schema-stepresponse-property-name"></a>[`name`](#schema-stepresponse-property-name) (required) | `string` | The workflow step's display name. |
| <a id="schema-stepresponse-property-launchtemplate"></a>[`launchTemplate`](#schema-stepresponse-property-launchtemplate) | `null` or `string` | The recorded launch-template name; absent when unavailable. |
| <a id="schema-stepresponse-property-groupname"></a>[`groupName`](#schema-stepresponse-property-groupname) | `null` or `string` | The recorded step group; absent when unavailable. |
| <a id="schema-stepresponse-property-parallel"></a>[`parallel`](#schema-stepresponse-property-parallel) (required) | `boolean` | Whether the workflow marks this step as parallel. |
| <a id="schema-stepresponse-property-position"></a>[`position`](#schema-stepresponse-property-position) (required) | `integer` (`int32`) | The step's zero-based position in the workflow's execution order. The list sorts by this field, not by a timestamp. |
| <a id="schema-stepresponse-property-startedat"></a>[`startedAt`](#schema-stepresponse-property-startedat) | `null` or `string` (`date-time`) | The earliest recorded start time across this step's selected instance executions, in UTC; absent when none have a start time. |
| <a id="schema-stepresponse-property-completedat"></a>[`completedAt`](#schema-stepresponse-property-completedat) | `null` or `string` (`date-time`) | The latest recorded completion time across this step's selected instance executions, in UTC; absent when none have a completion time. |
| <a id="schema-stepresponse-property-instances"></a>[`instances`](#schema-stepresponse-property-instances) (required) | [`InstanceCollectionSummary`](#schema-InstanceCollectionSummary) | Counts for this step's workflow instances (this step on each agent) and their restarts. Follow links.instances for their records. |
| <a id="schema-stepresponse-property-links"></a>[`links`](#schema-stepresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self, runGroup, instances filtered to this step, and the run group's agents. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The step identifier within the run group's workflow, not its display name. It can contain colons. URL-encode it as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The workflow step's recorded status, not a live progress state.",
      "title": "String"
    },
    "name": {
      "type": "string",
      "description": "The workflow step's display name.",
      "title": "String"
    },
    "launchTemplate": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded launch-template name; absent when unavailable.",
      "title": "String"
    },
    "groupName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded step group; absent when unavailable.",
      "title": "String"
    },
    "parallel": {
      "type": "boolean",
      "description": "Whether the workflow marks this step as parallel.",
      "title": "Boolean"
    },
    "position": {
      "type": "integer",
      "format": "int32",
      "description": "The step's zero-based position in the workflow's execution order. The list sorts by this field, not by a timestamp.",
      "title": "Int"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The earliest recorded start time across this step's selected instance executions, in UTC; absent when none have a start time.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The latest recorded completion time across this step's selected instance executions, in UTC; absent when none have a completion time.",
      "title": "String"
    },
    "instances": {
      "$ref": "#/components/schemas/InstanceCollectionSummary",
      "description": "Counts for this step's workflow instances (this step on each agent) and their restarts. Follow links.instances for their records."
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self, runGroup, instances filtered to this step, and the run group's agents.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "id",
    "instances",
    "links",
    "name",
    "parallel",
    "position",
    "status"
  ],
  "title": "StepResponse"
}
```

</details>

<a id="schema-PageResponse_StepResponse"></a>

### PageResponse_StepResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_stepresponse-property-items"></a>[`items`](#schema-pageresponse_stepresponse-property-items) (required) | [`StepResponse[]`](#schema-StepResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_stepresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_stepresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_stepresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_stepresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/StepResponse"
      },
      "title": "ArrayList_StepResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_StepResponse"
}
```

</details>

<a id="schema-InstanceRowResponse"></a>

### InstanceRowResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instancerowresponse-property-stepid"></a>[`stepId`](#schema-instancerowresponse-property-stepid) (required) | `string` | The workflow step's id, which can contain colons. URL-encode stepId and agentName as separate path segments, or follow links.self. |
| <a id="schema-instancerowresponse-property-stepname"></a>[`stepName`](#schema-instancerowresponse-property-stepname) (required) | `string` | The workflow step's display name. |
| <a id="schema-instancerowresponse-property-agentname"></a>[`agentName`](#schema-instancerowresponse-property-agentname) | `null` or `string` | The recorded agent identity; absent when unavailable. Older executions can lack this identity. Follow links.self to address the instance even when agentName is absent. |
| <a id="schema-instancerowresponse-property-name"></a>[`name`](#schema-instancerowresponse-property-name) (required) | `string` | The selected execution's name, not the step id or agent identity. |
| <a id="schema-instancerowresponse-property-status"></a>[`status`](#schema-instancerowresponse-property-status) (required) | `string` | The selected execution's recorded workflow status, not a live progress state. |
| <a id="schema-instancerowresponse-property-startedat"></a>[`startedAt`](#schema-instancerowresponse-property-startedat) | `null` or `string` (`date-time`) | The recorded instance start time, in UTC; absent when unavailable. |
| <a id="schema-instancerowresponse-property-completedat"></a>[`completedAt`](#schema-instancerowresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded instance completion time, in UTC; absent when unavailable. |
| <a id="schema-instancerowresponse-property-restartattempts"></a>[`restartAttempts`](#schema-instancerowresponse-property-restartattempts) | `integer` (`int32`) | The number of superseded executions of this step on this agent, not agent boots. Follow links.self for priorRuns. |
| <a id="schema-instancerowresponse-property-assets"></a>[`assets`](#schema-instancerowresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Log asset API URLs for the selected execution. Follow each URL for a signed download redirect. |
| <a id="schema-instancerowresponse-property-links"></a>[`links`](#schema-instancerowresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self, runGroup, step, and agent when recorded. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "stepId": {
      "type": "string",
      "description": "The workflow step's id, which can contain colons. URL-encode stepId and agentName as separate path segments, or follow links.self.",
      "title": "String"
    },
    "stepName": {
      "type": "string",
      "description": "The workflow step's display name.",
      "title": "String"
    },
    "agentName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded agent identity; absent when unavailable. Older executions can lack this identity. Follow links.self to address the instance even when agentName is absent.",
      "title": "String"
    },
    "name": {
      "type": "string",
      "description": "The selected execution's name, not the step id or agent identity.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The selected execution's recorded workflow status, not a live progress state.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded instance start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded instance completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "restartAttempts": {
      "type": "integer",
      "format": "int32",
      "description": "The number of superseded executions of this step on this agent, not agent boots. Follow links.self for priorRuns.",
      "title": "Int"
    },
    "assets": {
      "type": "array",
      "description": "Log asset API URLs for the selected execution. Follow each URL for a signed download redirect.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self, runGroup, step, and agent when recorded.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "assets",
    "links",
    "name",
    "status",
    "stepId",
    "stepName"
  ],
  "title": "InstanceRowResponse"
}
```

</details>

<a id="schema-DataAsset"></a>

### DataAsset

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-dataasset-property-type"></a>[`type`](#schema-dataasset-property-type) (required) | [`AssetType`](#schema-AssetType) | The asset category: logs for execution output, artifact for task outputs, sandbox-report for an Ultracache report, or resource-utilization for CPU, memory, and I/O samples. |
| <a id="schema-dataasset-property-url"></a>[`url`](#schema-dataasset-property-url) (required) | `string` | A relative authenticated API URL. GET returns a 302 redirect to a time-limited signed download URL. Do not forward API credentials to the download host. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "type": {
      "$ref": "#/components/schemas/AssetType",
      "description": "The asset category: logs for execution output, artifact for task outputs, sandbox-report for an Ultracache report, or resource-utilization for CPU, memory, and I/O samples."
    },
    "url": {
      "type": "string",
      "description": "A relative authenticated API URL. GET returns a 302 redirect to a time-limited signed download URL. Do not forward API credentials to the download host.",
      "title": "String"
    }
  },
  "required": [
    "type",
    "url"
  ],
  "title": "DataAsset"
}
```

</details>

<a id="schema-AssetType"></a>

### AssetType

Type: `string`. Allowed: `logs`, `artifact`, `sandbox-report`, `resource-utilization`.

<details>
<summary>Schema definition</summary>

```json
{
  "type": "string",
  "enum": [
    "logs",
    "artifact",
    "sandbox-report",
    "resource-utilization"
  ],
  "title": "AssetType"
}
```

</details>

<a id="schema-PageResponse_InstanceRowResponse"></a>

### PageResponse_InstanceRowResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_instancerowresponse-property-items"></a>[`items`](#schema-pageresponse_instancerowresponse-property-items) (required) | [`InstanceRowResponse[]`](#schema-InstanceRowResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_instancerowresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_instancerowresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_instancerowresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_instancerowresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/InstanceRowResponse"
      },
      "title": "ArrayList_InstanceRowResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_InstanceRowResponse"
}
```

</details>

<a id="schema-InstanceResourceUsage"></a>

### InstanceResourceUsage

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instanceresourceusage-property-cpus"></a>[`cpus`](#schema-instanceresourceusage-property-cpus) (required) | `number` (`float`) | The recorded CPU allocation, in cores; not sampled CPU utilization. |
| <a id="schema-instanceresourceusage-property-memorygbs"></a>[`memoryGbs`](#schema-instanceresourceusage-property-memorygbs) (required) | `number` (`float`) | The recorded memory allocation, in gigabytes; not sampled memory utilization. |
| <a id="schema-instanceresourceusage-property-resourceclass"></a>[`resourceClass`](#schema-instanceresourceusage-property-resourceclass) (required) | `string` | The recorded resource class name. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "cpus": {
      "type": "number",
      "format": "float",
      "description": "The recorded CPU allocation, in cores; not sampled CPU utilization.",
      "title": "Float"
    },
    "memoryGbs": {
      "type": "number",
      "format": "float",
      "description": "The recorded memory allocation, in gigabytes; not sampled memory utilization.",
      "title": "Float"
    },
    "resourceClass": {
      "type": "string",
      "description": "The recorded resource class name.",
      "title": "String"
    }
  },
  "required": [
    "cpus",
    "memoryGbs",
    "resourceClass"
  ],
  "title": "InstanceResourceUsage"
}
```

</details>

<a id="schema-InstanceTerminationStatusResponse"></a>

### InstanceTerminationStatusResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instanceterminationstatusresponse-property-exitcode"></a>[`exitCode`](#schema-instanceterminationstatusresponse-property-exitcode) (required) | `integer` (`int64`) | The recorded container exit code. |
| <a id="schema-instanceterminationstatusresponse-property-name"></a>[`name`](#schema-instanceterminationstatusresponse-property-name) (required) | `string` | The terminated container's name. |
| <a id="schema-instanceterminationstatusresponse-property-reason"></a>[`reason`](#schema-instanceterminationstatusresponse-property-reason) (required) | `string` | The recorded container termination reason. |
| <a id="schema-instanceterminationstatusresponse-property-message"></a>[`message`](#schema-instanceterminationstatusresponse-property-message) (required) | `string` | The recorded container termination message. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "exitCode": {
      "type": "integer",
      "format": "int64",
      "description": "The recorded container exit code.",
      "title": "Long"
    },
    "name": {
      "type": "string",
      "description": "The terminated container's name.",
      "title": "String"
    },
    "reason": {
      "type": "string",
      "description": "The recorded container termination reason.",
      "title": "String"
    },
    "message": {
      "type": "string",
      "description": "The recorded container termination message.",
      "title": "String"
    }
  },
  "required": [
    "exitCode",
    "message",
    "name",
    "reason"
  ],
  "title": "InstanceTerminationStatusResponse"
}
```

</details>

<a id="schema-InstanceTimeoutInfoResponse"></a>

### InstanceTimeoutInfoResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instancetimeoutinforesponse-property-reason"></a>[`reason`](#schema-instancetimeoutinforesponse-property-reason) (required) | `string` | The recorded timeout reason. |
| <a id="schema-instancetimeoutinforesponse-property-durationseconds"></a>[`durationSeconds`](#schema-instancetimeoutinforesponse-property-durationseconds) (required) | `integer` (`int64`) | The timeout duration, in seconds. |
| <a id="schema-instancetimeoutinforesponse-property-configsource"></a>[`configSource`](#schema-instancetimeoutinforesponse-property-configsource) (required) | `string` | The recorded source of the timeout configuration. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "reason": {
      "type": "string",
      "description": "The recorded timeout reason.",
      "title": "String"
    },
    "durationSeconds": {
      "type": "integer",
      "format": "int64",
      "description": "The timeout duration, in seconds.",
      "title": "Long"
    },
    "configSource": {
      "type": "string",
      "description": "The recorded source of the timeout configuration.",
      "title": "String"
    }
  },
  "required": [
    "configSource",
    "durationSeconds",
    "reason"
  ],
  "title": "InstanceTimeoutInfoResponse"
}
```

</details>

<a id="schema-InstancePriorRunResponse"></a>

### InstancePriorRunResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instancepriorrunresponse-property-name"></a>[`name`](#schema-instancepriorrunresponse-property-name) (required) | `string` | The superseded execution's recorded name. |
| <a id="schema-instancepriorrunresponse-property-status"></a>[`status`](#schema-instancepriorrunresponse-property-status) (required) | `string` | The superseded execution's recorded status. |
| <a id="schema-instancepriorrunresponse-property-startedat"></a>[`startedAt`](#schema-instancepriorrunresponse-property-startedat) | `null` or `string` (`date-time`) | The superseded execution's recorded start time, in UTC; absent when unavailable. |
| <a id="schema-instancepriorrunresponse-property-completedat"></a>[`completedAt`](#schema-instancepriorrunresponse-property-completedat) | `null` or `string` (`date-time`) | The superseded execution's recorded completion time, in UTC; absent when unavailable. |
| <a id="schema-instancepriorrunresponse-property-assets"></a>[`assets`](#schema-instancepriorrunresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Log asset API URLs with the run index already set. The download can return 404 if the log upload never completed. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The superseded execution's recorded name.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The superseded execution's recorded status.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The superseded execution's recorded start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The superseded execution's recorded completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "assets": {
      "type": "array",
      "description": "Log asset API URLs with the run index already set. The download can return 404 if the log upload never completed.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    }
  },
  "required": [
    "assets",
    "name",
    "status"
  ],
  "title": "InstancePriorRunResponse"
}
```

</details>

<a id="schema-InstanceResponse"></a>

### InstanceResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-instanceresponse-property-stepid"></a>[`stepId`](#schema-instanceresponse-property-stepid) (required) | `string` | The workflow step's id, which can contain colons. URL-encode stepId and agentName as separate path segments, or follow links.self. |
| <a id="schema-instanceresponse-property-stepname"></a>[`stepName`](#schema-instanceresponse-property-stepname) (required) | `string` | The workflow step's display name. |
| <a id="schema-instanceresponse-property-agentname"></a>[`agentName`](#schema-instanceresponse-property-agentname) | `null` or `string` | The recorded agent identity; absent when unavailable. Older executions can lack this identity. Follow links.self to address the instance even when agentName is absent. |
| <a id="schema-instanceresponse-property-name"></a>[`name`](#schema-instanceresponse-property-name) (required) | `string` | The selected execution's name, not the step id or agent identity. |
| <a id="schema-instanceresponse-property-status"></a>[`status`](#schema-instanceresponse-property-status) (required) | `string` | The selected execution's recorded workflow status, not a live progress state. |
| <a id="schema-instanceresponse-property-startedat"></a>[`startedAt`](#schema-instanceresponse-property-startedat) | `null` or `string` (`date-time`) | The recorded instance start time, in UTC; absent when unavailable. |
| <a id="schema-instanceresponse-property-completedat"></a>[`completedAt`](#schema-instanceresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded instance completion time, in UTC; absent when unavailable. |
| <a id="schema-instanceresponse-property-resourceusage"></a>[`resourceUsage`](#schema-instanceresponse-property-resourceusage) | `null` or [`InstanceResourceUsage`](#schema-InstanceResourceUsage) | The recorded resource allocation; absent when unavailable. |
| <a id="schema-instanceresponse-property-terminationstatuses"></a>[`terminationStatuses`](#schema-instanceresponse-property-terminationstatuses) | [`InstanceTerminationStatusResponse[]`](#schema-InstanceTerminationStatusResponse) | Recorded container termination details; empty when none were recorded. |
| <a id="schema-instanceresponse-property-timeoutinfo"></a>[`timeoutInfo`](#schema-instanceresponse-property-timeoutinfo) | `null` or [`InstanceTimeoutInfoResponse`](#schema-InstanceTimeoutInfoResponse) | The recorded timeout details; absent when none were recorded. |
| <a id="schema-instanceresponse-property-assets"></a>[`assets`](#schema-instanceresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Log asset API URLs for the selected execution. Follow each URL for a signed download redirect. |
| <a id="schema-instanceresponse-property-priorruns"></a>[`priorRuns`](#schema-instanceresponse-property-priorruns) | [`InstancePriorRunResponse[]`](#schema-InstancePriorRunResponse) | Superseded executions of this step on this agent, sorted by start time then name in ascending order. They can start after the selected execution. Zero-based array positions select the asset run query parameter. |
| <a id="schema-instanceresponse-property-links"></a>[`links`](#schema-instanceresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self, runGroup, step, and agent when recorded. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "stepId": {
      "type": "string",
      "description": "The workflow step's id, which can contain colons. URL-encode stepId and agentName as separate path segments, or follow links.self.",
      "title": "String"
    },
    "stepName": {
      "type": "string",
      "description": "The workflow step's display name.",
      "title": "String"
    },
    "agentName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded agent identity; absent when unavailable. Older executions can lack this identity. Follow links.self to address the instance even when agentName is absent.",
      "title": "String"
    },
    "name": {
      "type": "string",
      "description": "The selected execution's name, not the step id or agent identity.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The selected execution's recorded workflow status, not a live progress state.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded instance start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded instance completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "resourceUsage": {
      "description": "The recorded resource allocation; absent when unavailable.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/InstanceResourceUsage"
        }
      ]
    },
    "terminationStatuses": {
      "type": "array",
      "description": "Recorded container termination details; empty when none were recorded.",
      "items": {
        "$ref": "#/components/schemas/InstanceTerminationStatusResponse"
      },
      "title": "ArrayList_InstanceTerminationStatusResponse"
    },
    "timeoutInfo": {
      "description": "The recorded timeout details; absent when none were recorded.",
      "oneOf": [
        {
          "type": "null"
        },
        {
          "$ref": "#/components/schemas/InstanceTimeoutInfoResponse"
        }
      ]
    },
    "assets": {
      "type": "array",
      "description": "Log asset API URLs for the selected execution. Follow each URL for a signed download redirect.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    },
    "priorRuns": {
      "type": "array",
      "description": "Superseded executions of this step on this agent, sorted by start time then name in ascending order. They can start after the selected execution. Zero-based array positions select the asset run query parameter.",
      "items": {
        "$ref": "#/components/schemas/InstancePriorRunResponse"
      },
      "title": "ArrayList_InstancePriorRunResponse"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self, runGroup, step, and agent when recorded.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "assets",
    "links",
    "name",
    "status",
    "stepId",
    "stepName"
  ],
  "title": "InstanceResponse"
}
```

</details>

<a id="schema-AgentResponse"></a>

### AgentResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-agentresponse-property-name"></a>[`name`](#schema-agentresponse-property-name) (required) | `string` | The agent name used in paths. Nx managed restarts share one identity. BYOC uses its display name, or instanceName when no display name exists, so restarts can have different names. URL-encode name as one path segment. |
| <a id="schema-agentresponse-property-status"></a>[`status`](#schema-agentresponse-property-status) (required) | `string` | OFFLINE when an offline time exists; otherwise ONLINE. This describes the selected boot's recorded times, not a live probe. |
| <a id="schema-agentresponse-property-instancename"></a>[`instanceName`](#schema-agentresponse-property-instancename) (required) | `string` | The selected boot's full instance name. The endpoint description explains boot selection. Use name, not instanceName, to address the agent. |
| <a id="schema-agentresponse-property-launchtemplate"></a>[`launchTemplate`](#schema-agentresponse-property-launchtemplate) | `null` or `string` | The recorded launch-template name; absent when unavailable. |
| <a id="schema-agentresponse-property-cpucores"></a>[`cpuCores`](#schema-agentresponse-property-cpucores) | `null` or `integer` (`int64`) | The reported CPU core count; absent when system information is unavailable. |
| <a id="schema-agentresponse-property-totalmemory"></a>[`totalMemory`](#schema-agentresponse-property-totalmemory) | `null` or `integer` (`int64`) | The reported total system memory, in bytes; absent when system information is unavailable. |
| <a id="schema-agentresponse-property-onlineat"></a>[`onlineAt`](#schema-agentresponse-property-onlineat) | `null` or `string` (`date-time`) | The selected boot's online time, in UTC; absent when unavailable. Agent list ordering uses 1970-01-01T00:00:00Z for missing times and follows the requested sort direction. |
| <a id="schema-agentresponse-property-offlineat"></a>[`offlineAt`](#schema-agentresponse-property-offlineat) | `null` or `string` (`date-time`) | The recorded boot offline time, in UTC; absent when no offline time exists. |
| <a id="schema-agentresponse-property-avgcpu"></a>[`avgCpu`](#schema-agentresponse-property-avgcpu) | `null` or `number` (`double`) | The average sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable. |
| <a id="schema-agentresponse-property-maxcpu"></a>[`maxCpu`](#schema-agentresponse-property-maxcpu) | `null` or `number` (`double`) | The maximum sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable. |
| <a id="schema-agentresponse-property-avgmemory"></a>[`avgMemory`](#schema-agentresponse-property-avgmemory) | `null` or `number` (`double`) | The average sampled memory usage, in bytes; absent when metrics are unavailable. |
| <a id="schema-agentresponse-property-maxmemory"></a>[`maxMemory`](#schema-agentresponse-property-maxmemory) | `null` or `number` (`double`) | The maximum sampled memory usage, in bytes; absent when metrics are unavailable. |
| <a id="schema-agentresponse-property-instances"></a>[`instances`](#schema-agentresponse-property-instances) (required) | [`InstanceCollectionSummary`](#schema-InstanceCollectionSummary) | Counts for this agent's workflow instances (one step on this agent) and restarts. Empty for an agent without a workflow, including BYOC. |
| <a id="schema-agentresponse-property-assets"></a>[`assets`](#schema-agentresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Resource-utilization asset API URLs for the selected boot. Follow each URL for a signed download redirect. |
| <a id="schema-agentresponse-property-priorboots"></a>[`priorBoots`](#schema-agentresponse-property-priorboots) | [`AgentBootResponse[]`](#schema-AgentBootResponse) | Earlier boots, oldest first. Zero-based array positions select the asset boot query parameter. Omit boot to select the current response's boot. |
| <a id="schema-agentresponse-property-links"></a>[`links`](#schema-agentresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self and runGroup; instances and steps appear only when a workflow exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The agent name used in paths. Nx managed restarts share one identity. BYOC uses its display name, or instanceName when no display name exists, so restarts can have different names. URL-encode name as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "OFFLINE when an offline time exists; otherwise ONLINE. This describes the selected boot's recorded times, not a live probe.",
      "title": "String"
    },
    "instanceName": {
      "type": "string",
      "description": "The selected boot's full instance name. The endpoint description explains boot selection. Use name, not instanceName, to address the agent.",
      "title": "String"
    },
    "launchTemplate": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded launch-template name; absent when unavailable.",
      "title": "String"
    },
    "cpuCores": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The reported CPU core count; absent when system information is unavailable.",
      "title": "Long"
    },
    "totalMemory": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The reported total system memory, in bytes; absent when system information is unavailable.",
      "title": "Long"
    },
    "onlineAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The selected boot's online time, in UTC; absent when unavailable. Agent list ordering uses 1970-01-01T00:00:00Z for missing times and follows the requested sort direction.",
      "title": "String"
    },
    "offlineAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded boot offline time, in UTC; absent when no offline time exists.",
      "title": "String"
    },
    "avgCpu": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The average sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable.",
      "title": "Double"
    },
    "maxCpu": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The maximum sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable.",
      "title": "Double"
    },
    "avgMemory": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The average sampled memory usage, in bytes; absent when metrics are unavailable.",
      "title": "Double"
    },
    "maxMemory": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The maximum sampled memory usage, in bytes; absent when metrics are unavailable.",
      "title": "Double"
    },
    "instances": {
      "$ref": "#/components/schemas/InstanceCollectionSummary",
      "description": "Counts for this agent's workflow instances (one step on this agent) and restarts. Empty for an agent without a workflow, including BYOC."
    },
    "assets": {
      "type": "array",
      "description": "Resource-utilization asset API URLs for the selected boot. Follow each URL for a signed download redirect.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    },
    "priorBoots": {
      "type": "array",
      "description": "Earlier boots, oldest first. Zero-based array positions select the asset boot query parameter. Omit boot to select the current response's boot.",
      "items": {
        "$ref": "#/components/schemas/AgentBootResponse"
      },
      "title": "ArrayList_AgentBootResponse"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self and runGroup; instances and steps appear only when a workflow exists.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "assets",
    "instanceName",
    "instances",
    "links",
    "name",
    "status"
  ],
  "title": "AgentResponse"
}
```

</details>

<a id="schema-AgentBootResponse"></a>

### AgentBootResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-agentbootresponse-property-instancename"></a>[`instanceName`](#schema-agentbootresponse-property-instancename) (required) | `string` | The earlier boot's full instance name. It identifies the boot, not the agent name used in paths. |
| <a id="schema-agentbootresponse-property-status"></a>[`status`](#schema-agentbootresponse-property-status) (required) | `string` | OFFLINE when an offline time exists; otherwise ONLINE. This describes the earlier boot's recorded times, not a live probe. |
| <a id="schema-agentbootresponse-property-launchtemplate"></a>[`launchTemplate`](#schema-agentbootresponse-property-launchtemplate) | `null` or `string` | The recorded launch-template name; absent when unavailable. |
| <a id="schema-agentbootresponse-property-onlineat"></a>[`onlineAt`](#schema-agentbootresponse-property-onlineat) | `null` or `string` (`date-time`) | The recorded boot online time, in UTC; absent when unavailable. |
| <a id="schema-agentbootresponse-property-offlineat"></a>[`offlineAt`](#schema-agentbootresponse-property-offlineat) | `null` or `string` (`date-time`) | The recorded boot offline time, in UTC; absent when unavailable. |
| <a id="schema-agentbootresponse-property-cpucores"></a>[`cpuCores`](#schema-agentbootresponse-property-cpucores) | `null` or `integer` (`int64`) | The reported CPU core count; absent when system information is unavailable. |
| <a id="schema-agentbootresponse-property-totalmemory"></a>[`totalMemory`](#schema-agentbootresponse-property-totalmemory) | `null` or `integer` (`int64`) | The reported total system memory, in bytes; absent when system information is unavailable. |
| <a id="schema-agentbootresponse-property-avgcpu"></a>[`avgCpu`](#schema-agentbootresponse-property-avgcpu) | `null` or `number` (`double`) | The average sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable. |
| <a id="schema-agentbootresponse-property-maxcpu"></a>[`maxCpu`](#schema-agentbootresponse-property-maxcpu) | `null` or `number` (`double`) | The maximum sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable. |
| <a id="schema-agentbootresponse-property-avgmemory"></a>[`avgMemory`](#schema-agentbootresponse-property-avgmemory) | `null` or `number` (`double`) | The average sampled memory usage, in bytes; absent when metrics are unavailable. |
| <a id="schema-agentbootresponse-property-maxmemory"></a>[`maxMemory`](#schema-agentbootresponse-property-maxmemory) | `null` or `number` (`double`) | The maximum sampled memory usage, in bytes; absent when metrics are unavailable. |
| <a id="schema-agentbootresponse-property-assets"></a>[`assets`](#schema-agentbootresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Asset API URLs with the boot index already set. The download can return 404 if the report upload never completed. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "instanceName": {
      "type": "string",
      "description": "The earlier boot's full instance name. It identifies the boot, not the agent name used in paths.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "OFFLINE when an offline time exists; otherwise ONLINE. This describes the earlier boot's recorded times, not a live probe.",
      "title": "String"
    },
    "launchTemplate": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded launch-template name; absent when unavailable.",
      "title": "String"
    },
    "onlineAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded boot online time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "offlineAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded boot offline time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "cpuCores": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The reported CPU core count; absent when system information is unavailable.",
      "title": "Long"
    },
    "totalMemory": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int64",
      "description": "The reported total system memory, in bytes; absent when system information is unavailable.",
      "title": "Long"
    },
    "avgCpu": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The average sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable.",
      "title": "Double"
    },
    "maxCpu": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The maximum sampled CPU usage across cores, in percent (100 per full core); absent when metrics are unavailable.",
      "title": "Double"
    },
    "avgMemory": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The average sampled memory usage, in bytes; absent when metrics are unavailable.",
      "title": "Double"
    },
    "maxMemory": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "The maximum sampled memory usage, in bytes; absent when metrics are unavailable.",
      "title": "Double"
    },
    "assets": {
      "type": "array",
      "description": "Asset API URLs with the boot index already set. The download can return 404 if the report upload never completed.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    }
  },
  "required": [
    "assets",
    "instanceName",
    "status"
  ],
  "title": "AgentBootResponse"
}
```

</details>

<a id="schema-PageResponse_AgentResponse"></a>

### PageResponse_AgentResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_agentresponse-property-items"></a>[`items`](#schema-pageresponse_agentresponse-property-items) (required) | [`AgentResponse[]`](#schema-AgentResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_agentresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_agentresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_agentresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_agentresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/AgentResponse"
      },
      "title": "ArrayList_AgentResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_AgentResponse"
}
```

</details>

<a id="schema-RunListResponse"></a>

### RunListResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-runlistresponse-property-id"></a>[`id`](#schema-runlistresponse-property-id) (required) | `string` | The run identifier used in Nx Cloud run URLs. Treat it as an opaque string. Use it as runId, URL-encoded as one path segment. |
| <a id="schema-runlistresponse-property-status"></a>[`status`](#schema-runlistresponse-property-status) (required) | `string` | The status derived from the exit code: UNKNOWN when unavailable, SUCCEEDED for 0, CANCELED for 130, otherwise FAILED. Not a live progress state. |
| <a id="schema-runlistresponse-property-createdat"></a>[`createdAt`](#schema-runlistresponse-property-createdat) (required) | `string` (`date-time`) | The run record creation time, in UTC. |
| <a id="schema-runlistresponse-property-updatedat"></a>[`updatedAt`](#schema-runlistresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when unavailable. |
| <a id="schema-runlistresponse-property-startedat"></a>[`startedAt`](#schema-runlistresponse-property-startedat) | `null` or `string` (`date-time`) | The recorded Nx invocation start time, in UTC; absent when unavailable. |
| <a id="schema-runlistresponse-property-completedat"></a>[`completedAt`](#schema-runlistresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded Nx invocation completion time, in UTC; absent when unavailable. |
| <a id="schema-runlistresponse-property-command"></a>[`command`](#schema-runlistresponse-property-command) (required) | `string` | The recorded Nx invocation command. |
| <a id="schema-runlistresponse-property-branch"></a>[`branch`](#schema-runlistresponse-property-branch) | `null` or `string` | The recorded branch; absent when unavailable. |
| <a id="schema-runlistresponse-property-rungroup"></a>[`runGroup`](#schema-runlistresponse-property-rungroup) | `null` or `string` | The raw parent run-group id; absent when the run recorded none. |
| <a id="schema-runlistresponse-property-commitsha"></a>[`commitSha`](#schema-runlistresponse-property-commitsha) | `null` or `string` | The recorded commit SHA; absent when unavailable. |
| <a id="schema-runlistresponse-property-cacheenabled"></a>[`cacheEnabled`](#schema-runlistresponse-property-cacheenabled) (required) | `boolean` | Whether caching was enabled for this run; not a cache-hit indicator. |
| <a id="schema-runlistresponse-property-isdte"></a>[`isDTE`](#schema-runlistresponse-property-isdte) (required) | `boolean` | True when the run has a distributed execution id; false for a single-machine run. |
| <a id="schema-runlistresponse-property-isci"></a>[`isCI`](#schema-runlistresponse-property-isci) (required) | `boolean` | True when the run recorded a branch, which identifies a CI run. |
| <a id="schema-runlistresponse-property-links"></a>[`links`](#schema-runlistresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self and tasks; runGroup appears only when recorded. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The run identifier used in Nx Cloud run URLs. Treat it as an opaque string. Use it as runId, URL-encoded as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The status derived from the exit code: UNKNOWN when unavailable, SUCCEEDED for 0, CANCELED for 130, otherwise FAILED. Not a live progress state.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The run record creation time, in UTC.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded Nx invocation start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded Nx invocation completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "command": {
      "type": "string",
      "description": "The recorded Nx invocation command.",
      "title": "String"
    },
    "branch": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded branch; absent when unavailable.",
      "title": "String"
    },
    "runGroup": {
      "type": [
        "null",
        "string"
      ],
      "description": "The raw parent run-group id; absent when the run recorded none.",
      "title": "String"
    },
    "commitSha": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded commit SHA; absent when unavailable.",
      "title": "String"
    },
    "cacheEnabled": {
      "type": "boolean",
      "description": "Whether caching was enabled for this run; not a cache-hit indicator.",
      "title": "Boolean"
    },
    "isDTE": {
      "type": "boolean",
      "description": "True when the run has a distributed execution id; false for a single-machine run.",
      "title": "Boolean"
    },
    "isCI": {
      "type": "boolean",
      "description": "True when the run recorded a branch, which identifies a CI run.",
      "title": "Boolean"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self and tasks; runGroup appears only when recorded.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "cacheEnabled",
    "command",
    "createdAt",
    "id",
    "isCI",
    "isDTE",
    "links",
    "status"
  ],
  "title": "RunListResponse"
}
```

</details>

<a id="schema-PageResponse_RunListResponse"></a>

### PageResponse_RunListResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_runlistresponse-property-items"></a>[`items`](#schema-pageresponse_runlistresponse-property-items) (required) | [`RunListResponse[]`](#schema-RunListResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_runlistresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_runlistresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_runlistresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_runlistresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/RunListResponse"
      },
      "title": "ArrayList_RunListResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_RunListResponse"
}
```

</details>

<a id="schema-TaskCollectionSummary"></a>

### TaskCollectionSummary

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskcollectionsummary-property-total"></a>[`total`](#schema-taskcollectionsummary-property-total) (required) | `integer` (`int32`) | The number of final task records before optional filters, not the number of attempts. Batch variants can share a task id. |
| <a id="schema-taskcollectionsummary-property-statuscounts"></a>[`statusCounts`](#schema-taskcollectionsummary-property-statuscounts) (required) | Dictionary of `integer` (`int32`) | Final task counts keyed by public status. Statuses with no tasks are absent. Counts sum to total. |
| <a id="schema-taskcollectionsummary-property-retried"></a>[`retried`](#schema-taskcollectionsummary-property-retried) (required) | `integer` (`int32`) | The number of task records with at least one prior failed attempt, not the number of attempts. |
| <a id="schema-taskcollectionsummary-property-retryattempts"></a>[`retryAttempts`](#schema-taskcollectionsummary-property-retryattempts) (required) | `integer` (`int32`) | The total number of prior failed attempts across task records, excluding their final attempts. |
| <a id="schema-taskcollectionsummary-property-retriedstatuscounts"></a>[`retriedStatusCounts`](#schema-taskcollectionsummary-property-retriedstatuscounts) (required) | Dictionary of `integer` (`int32`) | Final status counts for retried task records only. Statuses with no retried tasks are absent. Counts sum to retried. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "total": {
      "type": "integer",
      "format": "int32",
      "description": "The number of final task records before optional filters, not the number of attempts. Batch variants can share a task id.",
      "title": "Int"
    },
    "statusCounts": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "format": "int32",
        "title": "Int"
      },
      "description": "Final task counts keyed by public status. Statuses with no tasks are absent. Counts sum to total.",
      "title": "LinkedHashMap_String-Int"
    },
    "retried": {
      "type": "integer",
      "format": "int32",
      "description": "The number of task records with at least one prior failed attempt, not the number of attempts.",
      "title": "Int"
    },
    "retryAttempts": {
      "type": "integer",
      "format": "int32",
      "description": "The total number of prior failed attempts across task records, excluding their final attempts.",
      "title": "Int"
    },
    "retriedStatusCounts": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "format": "int32",
        "title": "Int"
      },
      "description": "Final status counts for retried task records only. Statuses with no retried tasks are absent. Counts sum to retried.",
      "title": "LinkedHashMap_String-Int"
    }
  },
  "required": [
    "retried",
    "retriedStatusCounts",
    "retryAttempts",
    "statusCounts",
    "total"
  ],
  "title": "TaskCollectionSummary"
}
```

</details>

<a id="schema-RunResponse"></a>

### RunResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-runresponse-property-id"></a>[`id`](#schema-runresponse-property-id) (required) | `string` | The run identifier used in Nx Cloud run URLs. Treat it as an opaque string. Use it as runId, URL-encoded as one path segment. |
| <a id="schema-runresponse-property-status"></a>[`status`](#schema-runresponse-property-status) (required) | `string` | The status derived from the exit code: UNKNOWN when unavailable, SUCCEEDED for 0, CANCELED for 130, otherwise FAILED. Not a live progress state. |
| <a id="schema-runresponse-property-createdat"></a>[`createdAt`](#schema-runresponse-property-createdat) (required) | `string` (`date-time`) | The run record creation time, in UTC. |
| <a id="schema-runresponse-property-updatedat"></a>[`updatedAt`](#schema-runresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when unavailable. |
| <a id="schema-runresponse-property-startedat"></a>[`startedAt`](#schema-runresponse-property-startedat) | `null` or `string` (`date-time`) | The recorded Nx invocation start time, in UTC; absent when unavailable. |
| <a id="schema-runresponse-property-completedat"></a>[`completedAt`](#schema-runresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded Nx invocation completion time, in UTC; absent when unavailable. |
| <a id="schema-runresponse-property-command"></a>[`command`](#schema-runresponse-property-command) (required) | `string` | The recorded Nx invocation command. |
| <a id="schema-runresponse-property-branch"></a>[`branch`](#schema-runresponse-property-branch) | `null` or `string` | The recorded branch; absent when unavailable. |
| <a id="schema-runresponse-property-rungroup"></a>[`runGroup`](#schema-runresponse-property-rungroup) | `null` or `string` | The raw parent run-group id; absent when the run recorded none. |
| <a id="schema-runresponse-property-commitsha"></a>[`commitSha`](#schema-runresponse-property-commitsha) | `null` or `string` | The recorded commit SHA; absent when unavailable. |
| <a id="schema-runresponse-property-cacheenabled"></a>[`cacheEnabled`](#schema-runresponse-property-cacheenabled) (required) | `boolean` | Whether caching was enabled for this run; not a cache-hit indicator. |
| <a id="schema-runresponse-property-isdte"></a>[`isDTE`](#schema-runresponse-property-isdte) (required) | `boolean` | True when the run has a distributed execution id; false for a single-machine run. |
| <a id="schema-runresponse-property-isci"></a>[`isCI`](#schema-runresponse-property-isci) (required) | `boolean` | True when the run recorded a branch, which identifies a CI run. |
| <a id="schema-runresponse-property-tasks"></a>[`tasks`](#schema-runresponse-property-tasks) (required) | [`TaskCollectionSummary`](#schema-TaskCollectionSummary) | Counts for all tasks and prior attempts without optional filters. Follow links.tasks for task records. |
| <a id="schema-runresponse-property-links"></a>[`links`](#schema-runresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self and tasks; runGroup appears only when recorded. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The run identifier used in Nx Cloud run URLs. Treat it as an opaque string. Use it as runId, URL-encoded as one path segment.",
      "title": "String"
    },
    "status": {
      "type": "string",
      "description": "The status derived from the exit code: UNKNOWN when unavailable, SUCCEEDED for 0, CANCELED for 130, otherwise FAILED. Not a live progress state.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The run record creation time, in UTC.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded Nx invocation start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded Nx invocation completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "command": {
      "type": "string",
      "description": "The recorded Nx invocation command.",
      "title": "String"
    },
    "branch": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded branch; absent when unavailable.",
      "title": "String"
    },
    "runGroup": {
      "type": [
        "null",
        "string"
      ],
      "description": "The raw parent run-group id; absent when the run recorded none.",
      "title": "String"
    },
    "commitSha": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded commit SHA; absent when unavailable.",
      "title": "String"
    },
    "cacheEnabled": {
      "type": "boolean",
      "description": "Whether caching was enabled for this run; not a cache-hit indicator.",
      "title": "Boolean"
    },
    "isDTE": {
      "type": "boolean",
      "description": "True when the run has a distributed execution id; false for a single-machine run.",
      "title": "Boolean"
    },
    "isCI": {
      "type": "boolean",
      "description": "True when the run recorded a branch, which identifies a CI run.",
      "title": "Boolean"
    },
    "tasks": {
      "$ref": "#/components/schemas/TaskCollectionSummary",
      "description": "Counts for all tasks and prior attempts without optional filters. Follow links.tasks for task records."
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self and tasks; runGroup appears only when recorded.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "cacheEnabled",
    "command",
    "createdAt",
    "id",
    "isCI",
    "isDTE",
    "links",
    "status",
    "tasks"
  ],
  "title": "RunResponse"
}
```

</details>

<a id="schema-TaskResponse"></a>

### TaskResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskresponse-property-id"></a>[`id`](#schema-taskresponse-property-id) (required) | `string` | The Nx task id in project:target[:configuration] form, such as myapp:build. URL-encode it as one path segment. Use batchId to distinguish variants within a run. |
| <a id="schema-taskresponse-property-status"></a>[`status`](#schema-taskresponse-property-status) (required) | [`TaskStatus`](#schema-TaskStatus) | The task's final status, including tasks that could not start or execute. |
| <a id="schema-taskresponse-property-startedat"></a>[`startedAt`](#schema-taskresponse-property-startedat) | `null` or `string` (`date-time`) | The recorded task start time, in UTC; absent when unavailable. |
| <a id="schema-taskresponse-property-completedat"></a>[`completedAt`](#schema-taskresponse-property-completedat) | `null` or `string` (`date-time`) | The recorded task completion time, in UTC; absent when unavailable. |
| <a id="schema-taskresponse-property-projectname"></a>[`projectName`](#schema-taskresponse-property-projectname) (required) | `string` | The Nx project name. |
| <a id="schema-taskresponse-property-target"></a>[`target`](#schema-taskresponse-property-target) (required) | `string` | The Nx target name. |
| <a id="schema-taskresponse-property-targetgroupname"></a>[`targetGroupName`](#schema-taskresponse-property-targetgroupname) | `null` or `string` | The recorded target group name; absent when unavailable. |
| <a id="schema-taskresponse-property-configuration"></a>[`configuration`](#schema-taskresponse-property-configuration) | `null` or `string` | The Nx target configuration; absent when not specified. |
| <a id="schema-taskresponse-property-params"></a>[`params`](#schema-taskresponse-property-params) (required) | `string` | The recorded task parameters. An empty string means no parameters were recorded. |
| <a id="schema-taskresponse-property-cachestatus"></a>[`cacheStatus`](#schema-taskresponse-property-cachestatus) (required) | `null` or `string` | The recorded cache result. Null when the task stopped before it produced a cache result. |
| <a id="schema-taskresponse-property-hash"></a>[`hash`](#schema-taskresponse-property-hash) (required) | `null` or `string` | The Nx computation hash, not the task identifier. Use it to compare computations. Null when the task stopped before hashing completed. |
| <a id="schema-taskresponse-property-continuous"></a>[`continuous`](#schema-taskresponse-property-continuous) (required) | `boolean` | Whether Nx configured the task to run continuously. |
| <a id="schema-taskresponse-property-cacheable"></a>[`cacheable`](#schema-taskresponse-property-cacheable) (required) | `boolean` | Whether the task was eligible for caching; this does not mean it used a cached result. |
| <a id="schema-taskresponse-property-batchid"></a>[`batchId`](#schema-taskresponse-property-batchid) | `null` or `string` | The batch identifier; absent for unbatched tasks. Supply it as the URL-encoded batchId query value to distinguish records with the same task id. |
| <a id="schema-taskresponse-property-agentname"></a>[`agentName`](#schema-taskresponse-property-agentname) | `null` or `string` | The assigned agent identity for a distributed run (DTE); absent for non-DTE runs and unassigned tasks. |
| <a id="schema-taskresponse-property-assets"></a>[`assets`](#schema-taskresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Asset API URLs for this attempt. Follow each URL to resolve a time-limited download redirect. |
| <a id="schema-taskresponse-property-priorattempts"></a>[`priorAttempts`](#schema-taskresponse-property-priorattempts) | [`TaskAttemptResponse[]`](#schema-TaskAttemptResponse) | Failed attempts before the final attempt, oldest first. Zero-based array positions select the asset attempt query parameter for logs. |
| <a id="schema-taskresponse-property-links"></a>[`links`](#schema-taskresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self and run; cacheOrigin appears only when requested and available. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The Nx task id in project:target[:configuration] form, such as myapp:build. URL-encode it as one path segment. Use batchId to distinguish variants within a run.",
      "title": "String"
    },
    "status": {
      "$ref": "#/components/schemas/TaskStatus",
      "description": "The task's final status, including tasks that could not start or execute."
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded task start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The recorded task completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "projectName": {
      "type": "string",
      "description": "The Nx project name.",
      "title": "String"
    },
    "target": {
      "type": "string",
      "description": "The Nx target name.",
      "title": "String"
    },
    "targetGroupName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded target group name; absent when unavailable.",
      "title": "String"
    },
    "configuration": {
      "type": [
        "null",
        "string"
      ],
      "description": "The Nx target configuration; absent when not specified.",
      "title": "String"
    },
    "params": {
      "type": "string",
      "description": "The recorded task parameters. An empty string means no parameters were recorded.",
      "title": "String"
    },
    "cacheStatus": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded cache result. Null when the task stopped before it produced a cache result.",
      "title": "String"
    },
    "hash": {
      "type": [
        "null",
        "string"
      ],
      "description": "The Nx computation hash, not the task identifier. Use it to compare computations. Null when the task stopped before hashing completed.",
      "title": "String"
    },
    "continuous": {
      "type": "boolean",
      "description": "Whether Nx configured the task to run continuously.",
      "title": "Boolean"
    },
    "cacheable": {
      "type": "boolean",
      "description": "Whether the task was eligible for caching; this does not mean it used a cached result.",
      "title": "Boolean"
    },
    "batchId": {
      "type": [
        "null",
        "string"
      ],
      "description": "The batch identifier; absent for unbatched tasks. Supply it as the URL-encoded batchId query value to distinguish records with the same task id.",
      "title": "String"
    },
    "agentName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The assigned agent identity for a distributed run (DTE); absent for non-DTE runs and unassigned tasks.",
      "title": "String"
    },
    "assets": {
      "type": "array",
      "description": "Asset API URLs for this attempt. Follow each URL to resolve a time-limited download redirect.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    },
    "priorAttempts": {
      "type": "array",
      "description": "Failed attempts before the final attempt, oldest first. Zero-based array positions select the asset attempt query parameter for logs.",
      "items": {
        "$ref": "#/components/schemas/TaskAttemptResponse"
      },
      "title": "ArrayList_TaskAttemptResponse"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self and run; cacheOrigin appears only when requested and available.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "assets",
    "cacheStatus",
    "cacheable",
    "continuous",
    "hash",
    "id",
    "links",
    "params",
    "projectName",
    "status",
    "target"
  ],
  "title": "TaskResponse"
}
```

</details>

<a id="schema-TaskStatus"></a>

### TaskStatus

Type: `string`. Allowed: `UNKNOWN`, `SUCCEEDED`, `FAILED`, `CANCELED`, `NOT_STARTED`, `DEPENDENCIES_FAILED`, `NOT_EXECUTABLE`, `TIMED_OUT`, `SCHEDULED_IMPLICITLY`.

<details>
<summary>Schema definition</summary>

```json
{
  "type": "string",
  "enum": [
    "UNKNOWN",
    "SUCCEEDED",
    "FAILED",
    "CANCELED",
    "NOT_STARTED",
    "DEPENDENCIES_FAILED",
    "NOT_EXECUTABLE",
    "TIMED_OUT",
    "SCHEDULED_IMPLICITLY"
  ],
  "title": "TaskStatus"
}
```

</details>

<a id="schema-TaskAttemptResponse"></a>

### TaskAttemptResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskattemptresponse-property-status"></a>[`status`](#schema-taskattemptresponse-property-status) (required) | `string` | The prior attempt's exit-code-derived status. |
| <a id="schema-taskattemptresponse-property-startedat"></a>[`startedAt`](#schema-taskattemptresponse-property-startedat) | `null` or `string` (`date-time`) | The prior attempt start time, in UTC; absent when unavailable. |
| <a id="schema-taskattemptresponse-property-completedat"></a>[`completedAt`](#schema-taskattemptresponse-property-completedat) | `null` or `string` (`date-time`) | The prior attempt completion time, in UTC; absent when unavailable. |
| <a id="schema-taskattemptresponse-property-assets"></a>[`assets`](#schema-taskattemptresponse-property-assets) (required) | [`DataAsset[]`](#schema-DataAsset) | Asset API URLs with the attempt index already set. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "description": "The prior attempt's exit-code-derived status.",
      "title": "String"
    },
    "startedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The prior attempt start time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "completedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The prior attempt completion time, in UTC; absent when unavailable.",
      "title": "String"
    },
    "assets": {
      "type": "array",
      "description": "Asset API URLs with the attempt index already set.",
      "items": {
        "$ref": "#/components/schemas/DataAsset"
      },
      "title": "ArrayList_DataAsset"
    }
  },
  "required": [
    "assets",
    "status"
  ],
  "title": "TaskAttemptResponse"
}
```

</details>

<a id="schema-PageResponse_TaskResponse"></a>

### PageResponse_TaskResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_taskresponse-property-items"></a>[`items`](#schema-pageresponse_taskresponse-property-items) (required) | [`TaskResponse[]`](#schema-TaskResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_taskresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_taskresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_taskresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_taskresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/TaskResponse"
      },
      "title": "ArrayList_TaskResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_TaskResponse"
}
```

</details>

<a id="schema-TaskInclude"></a>

### TaskInclude

Type: `string`. Allowed: `cacheOrigin`.

<details>
<summary>Schema definition</summary>

```json
{
  "type": "string",
  "enum": [
    "cacheOrigin"
  ],
  "title": "TaskInclude"
}
```

</details>

<a id="schema-TaskStatResponse"></a>

### TaskStatResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskstatresponse-property-date"></a>[`date`](#schema-taskstatresponse-property-date) (required) | `string` (`date-time`) | The UTC day at midnight, based on run creation time rather than task start time. |
| <a id="schema-taskstatresponse-property-projectname"></a>[`projectName`](#schema-taskstatresponse-property-projectname) (required) | `string` | The Nx project name shared by the tasks in this row. |
| <a id="schema-taskstatresponse-property-target"></a>[`target`](#schema-taskstatresponse-property-target) (required) | `string` | The Nx target name shared by the tasks in this row. |
| <a id="schema-taskstatresponse-property-targetgroupname"></a>[`targetGroupName`](#schema-taskstatresponse-property-targetgroupname) | `null` or `string` | The name of the project's target group that contains this target. Different groups have separate rows; absent when unavailable. |
| <a id="schema-taskstatresponse-property-isci"></a>[`isCI`](#schema-taskstatresponse-property-isci) (required) | `boolean` | Whether this row represents CI runs. Runs with a branch value count as CI; runs without one count as local. |
| <a id="schema-taskstatresponse-property-totalcount"></a>[`totalCount`](#schema-taskstatresponse-property-totalcount) (required) | `integer` (`int32`) | The number of task entries represented by this row, including cache hits. Only cache-enabled runs contribute. Excludes continuous tasks and nx-cloud start-agent runs. |
| <a id="schema-taskstatresponse-property-cachestatusratio"></a>[`cacheStatusRatio`](#schema-taskstatresponse-property-cachestatusratio) (required) | [`TaskStatCacheStatusRatio`](#schema-TaskStatCacheStatusRatio) | Fractions of totalCount for each cache result. They can sum to less than 1 when entries have other or unavailable cache results. |
| <a id="schema-taskstatresponse-property-averageduration"></a>[`averageDuration`](#schema-taskstatresponse-property-averageduration) (required) | [`TaskStatAverageDuration`](#schema-TaskStatAverageDuration) | Mean durations in milliseconds per cache category. Cache-miss means use successful executions only. |
| <a id="schema-taskstatresponse-property-statuscoderatio"></a>[`statusCodeRatio`](#schema-taskstatresponse-property-statuscoderatio) (required) | [`TaskStatStatusCodeRatio`](#schema-TaskStatStatusCodeRatio) | Exit-code fractions using totalCount as the denominator. |
| <a id="schema-taskstatresponse-property-durationpercentiles"></a>[`durationPercentiles`](#schema-taskstatresponse-property-durationpercentiles) | `null` or [`TaskStatDurationPercentile[]`](#schema-TaskStatDurationPercentile) | Approximate duration percentiles in milliseconds for successful cache misses in this row. Absent when no percentiles were requested; individual estimates can be null. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "date": {
      "type": "string",
      "format": "date-time",
      "description": "The UTC day at midnight, based on run creation time rather than task start time.",
      "title": "String"
    },
    "projectName": {
      "type": "string",
      "description": "The Nx project name shared by the tasks in this row.",
      "title": "String"
    },
    "target": {
      "type": "string",
      "description": "The Nx target name shared by the tasks in this row.",
      "title": "String"
    },
    "targetGroupName": {
      "type": [
        "null",
        "string"
      ],
      "description": "The name of the project's target group that contains this target. Different groups have separate rows; absent when unavailable.",
      "title": "String"
    },
    "isCI": {
      "type": "boolean",
      "description": "Whether this row represents CI runs. Runs with a branch value count as CI; runs without one count as local.",
      "title": "Boolean"
    },
    "totalCount": {
      "type": "integer",
      "format": "int32",
      "description": "The number of task entries represented by this row, including cache hits. Only cache-enabled runs contribute. Excludes continuous tasks and nx-cloud start-agent runs.",
      "title": "Int"
    },
    "cacheStatusRatio": {
      "$ref": "#/components/schemas/TaskStatCacheStatusRatio",
      "description": "Fractions of totalCount for each cache result. They can sum to less than 1 when entries have other or unavailable cache results."
    },
    "averageDuration": {
      "$ref": "#/components/schemas/TaskStatAverageDuration",
      "description": "Mean durations in milliseconds per cache category. Cache-miss means use successful executions only."
    },
    "statusCodeRatio": {
      "$ref": "#/components/schemas/TaskStatStatusCodeRatio",
      "description": "Exit-code fractions using totalCount as the denominator."
    },
    "durationPercentiles": {
      "type": [
        "null",
        "array"
      ],
      "description": "Approximate duration percentiles in milliseconds for successful cache misses in this row. Absent when no percentiles were requested; individual estimates can be null.",
      "items": {
        "$ref": "#/components/schemas/TaskStatDurationPercentile"
      },
      "title": "ArrayList_TaskStatDurationPercentile"
    }
  },
  "required": [
    "averageDuration",
    "cacheStatusRatio",
    "date",
    "isCI",
    "projectName",
    "statusCodeRatio",
    "target",
    "totalCount"
  ],
  "title": "TaskStatResponse"
}
```

</details>

<a id="schema-TaskStatCacheStatusRatio"></a>

### TaskStatCacheStatusRatio

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskstatcachestatusratio-property-localcachehit"></a>[`localCacheHit`](#schema-taskstatcachestatusratio-property-localcachehit) (required) | `number` (`double`) | Local-cache-hit task entries divided by totalCount, as a fraction from 0 to 1. minimum: `0`. maximum: `1`. |
| <a id="schema-taskstatcachestatusratio-property-remotecachehit"></a>[`remoteCacheHit`](#schema-taskstatcachestatusratio-property-remotecachehit) (required) | `number` (`double`) | Remote-cache-hit task entries divided by totalCount, as a fraction from 0 to 1. minimum: `0`. maximum: `1`. |
| <a id="schema-taskstatcachestatusratio-property-cachemiss"></a>[`cacheMiss`](#schema-taskstatcachestatusratio-property-cachemiss) (required) | `number` (`double`) | Cache-miss task entries, successful or failed, divided by totalCount, as a fraction from 0 to 1. minimum: `0`. maximum: `1`. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "localCacheHit": {
      "type": "number",
      "format": "double",
      "description": "Local-cache-hit task entries divided by totalCount, as a fraction from 0 to 1.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    },
    "remoteCacheHit": {
      "type": "number",
      "format": "double",
      "description": "Remote-cache-hit task entries divided by totalCount, as a fraction from 0 to 1.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    },
    "cacheMiss": {
      "type": "number",
      "format": "double",
      "description": "Cache-miss task entries, successful or failed, divided by totalCount, as a fraction from 0 to 1.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    }
  },
  "required": [
    "cacheMiss",
    "localCacheHit",
    "remoteCacheHit"
  ],
  "title": "TaskStatCacheStatusRatio"
}
```

</details>

<a id="schema-TaskStatAverageDuration"></a>

### TaskStatAverageDuration

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskstataverageduration-property-localcachehitms"></a>[`localCacheHitMs`](#schema-taskstataverageduration-property-localcachehitms) (required) | `number` (`double`) | Total local-cache-hit duration in milliseconds divided by the local-cache-hit count. Zero when no local hits contribute or their total duration is zero. |
| <a id="schema-taskstataverageduration-property-remotecachehitms"></a>[`remoteCacheHitMs`](#schema-taskstataverageduration-property-remotecachehitms) (required) | `number` (`double`) | Total remote-cache-hit duration in milliseconds divided by the remote-cache-hit count. Zero when no remote hits contribute or their total duration is zero. |
| <a id="schema-taskstataverageduration-property-cachemissms"></a>[`cacheMissMs`](#schema-taskstataverageduration-property-cachemissms) (required) | `number` (`double`) | Total successful cache-miss duration in milliseconds divided by the successful-cache-miss count. Zero when no successful misses contribute or their total duration is zero. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "localCacheHitMs": {
      "type": "number",
      "format": "double",
      "description": "Total local-cache-hit duration in milliseconds divided by the local-cache-hit count. Zero when no local hits contribute or their total duration is zero.",
      "title": "Double"
    },
    "remoteCacheHitMs": {
      "type": "number",
      "format": "double",
      "description": "Total remote-cache-hit duration in milliseconds divided by the remote-cache-hit count. Zero when no remote hits contribute or their total duration is zero.",
      "title": "Double"
    },
    "cacheMissMs": {
      "type": "number",
      "format": "double",
      "description": "Total successful cache-miss duration in milliseconds divided by the successful-cache-miss count. Zero when no successful misses contribute or their total duration is zero.",
      "title": "Double"
    }
  },
  "required": [
    "cacheMissMs",
    "localCacheHitMs",
    "remoteCacheHitMs"
  ],
  "title": "TaskStatAverageDuration"
}
```

</details>

<a id="schema-TaskStatStatusCodeRatio"></a>

### TaskStatStatusCodeRatio

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskstatstatuscoderatio-property-zero"></a>[`zero`](#schema-taskstatstatuscoderatio-property-zero) (required) | `number` (`double`) | Task entries with exit code 0 divided by totalCount, as a fraction from 0 to 1. minimum: `0`. maximum: `1`. |
| <a id="schema-taskstatstatuscoderatio-property-nonzero"></a>[`nonZero`](#schema-taskstatstatuscoderatio-property-nonzero) (required) | `number` (`double`) | Task entries whose exit code is not 0, including unavailable exit codes, divided by totalCount. Equals 1 minus zero; not a separate task status. minimum: `0`. maximum: `1`. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "zero": {
      "type": "number",
      "format": "double",
      "description": "Task entries with exit code 0 divided by totalCount, as a fraction from 0 to 1.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    },
    "nonZero": {
      "type": "number",
      "format": "double",
      "description": "Task entries whose exit code is not 0, including unavailable exit codes, divided by totalCount. Equals 1 minus zero; not a separate task status.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    }
  },
  "required": [
    "nonZero",
    "zero"
  ],
  "title": "TaskStatStatusCodeRatio"
}
```

</details>

<a id="schema-TaskStatDurationPercentile"></a>

### TaskStatDurationPercentile

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-taskstatdurationpercentile-property-percentile"></a>[`percentile`](#schema-taskstatdurationpercentile-property-percentile) (required) | `integer` (`int32`) | The requested percentile rank, from 0 to 100; 50 is the median and 95 is P95. minimum: `0`. maximum: `100`. |
| <a id="schema-taskstatdurationpercentile-property-cachemissms"></a>[`cacheMissMs`](#schema-taskstatdurationpercentile-property-cachemissms) (required) | `null` or `number` (`double`) | Approximate duration in milliseconds at the requested percentile for successful cache misses with nonnegative durations. Null means insufficient available duration data, not zero duration or proof that no cache misses occurred. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "percentile": {
      "type": "integer",
      "format": "int32",
      "description": "The requested percentile rank, from 0 to 100; 50 is the median and 95 is P95.",
      "maximum": 100,
      "minimum": 0,
      "title": "Int"
    },
    "cacheMissMs": {
      "type": [
        "null",
        "number"
      ],
      "format": "double",
      "description": "Approximate duration in milliseconds at the requested percentile for successful cache misses with nonnegative durations. Null means insufficient available duration data, not zero duration or proof that no cache misses occurred.",
      "title": "Double"
    }
  },
  "required": [
    "cacheMissMs",
    "percentile"
  ],
  "title": "TaskStatDurationPercentile"
}
```

</details>

<a id="schema-PageResponse_TaskStatResponse"></a>

### PageResponse_TaskStatResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_taskstatresponse-property-items"></a>[`items`](#schema-pageresponse_taskstatresponse-property-items) (required) | [`TaskStatResponse[]`](#schema-TaskStatResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_taskstatresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_taskstatresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_taskstatresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_taskstatresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/TaskStatResponse"
      },
      "title": "ArrayList_TaskStatResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_TaskStatResponse"
}
```

</details>

<a id="schema-FlakyTaskResponse"></a>

### FlakyTaskResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-flakytaskresponse-property-id"></a>[`id`](#schema-flakytaskresponse-property-id) (required) | `string` | The metric's 24-character hexadecimal public identifier. Use it as metricId to list contributing executions. |
| <a id="schema-flakytaskresponse-property-project"></a>[`project`](#schema-flakytaskresponse-property-project) (required) | `string` | The Nx project name for this window. |
| <a id="schema-flakytaskresponse-property-target"></a>[`target`](#schema-flakytaskresponse-property-target) (required) | `string` | The Nx target name for this window. |
| <a id="schema-flakytaskresponse-property-configuration"></a>[`configuration`](#schema-flakytaskresponse-property-configuration) | `null` or `string` | The Nx target configuration shared by this window's observations; absent when not specified. Different configurations have separate metric windows. |
| <a id="schema-flakytaskresponse-property-windowstart"></a>[`windowStart`](#schema-flakytaskresponse-property-windowstart) (required) | `string` (`date-time`) | The inclusive window start at UTC midnight. Observations use task start times. |
| <a id="schema-flakytaskresponse-property-windowend"></a>[`windowEnd`](#schema-flakytaskresponse-property-windowend) (required) | `string` (`date-time`) | The exclusive window end at the next UTC midnight. Today's window changes until it ends. |
| <a id="schema-flakytaskresponse-property-flakinessrate"></a>[`flakinessRate`](#schema-flakytaskresponse-property-flakinessrate) (required) | `number` (`double`) | Successful cache-miss observations for input hashes that have both successes and failures within this window, divided by all successful cache-miss observations. A fraction from 0 to 1, not a percentage or the fraction of failed attempts. minimum: `0`. maximum: `1`. |
| <a id="schema-flakytaskresponse-property-samplesizeflakinessrate"></a>[`sampleSizeFlakinessRate`](#schema-flakytaskresponse-property-samplesizeflakinessrate) (required) | `integer` (`int32`) | The denominator of flakinessRate: all successful cache-miss observations, not all attempts or unique runs. Use it to assess the amount of data behind the rate. |
| <a id="schema-flakytaskresponse-property-totalreruns"></a>[`totalReruns`](#schema-flakytaskresponse-property-totalreruns) (required) | `integer` (`int32`) | The number of cache-miss observations beyond the first for each task input hash in this window. Includes hashes with no mixed results. Not the number of runs that retried. |
| <a id="schema-flakytaskresponse-property-deflakedautomatically"></a>[`deflakedAutomatically`](#schema-flakytaskresponse-property-deflakedautomatically) (required) | `integer` (`int32`) | Counts a task input hash once per Nx execution if it has both successful and failed cache-miss attempts. One execution can count for multiple hashes. Does not establish attempt order or a successful final attempt. Attempts without an execution identifier can also contribute; they do not confirm a shared execution. |
| <a id="schema-flakytaskresponse-property-iscacheable"></a>[`isCacheable`](#schema-flakytaskresponse-property-iscacheable) | `null` or `boolean` | Whether Nx marked this window's tasks as cacheable. True, false, and unknown values have separate metric windows; absent means unknown, not false. |
| <a id="schema-flakytaskresponse-property-links"></a>[`links`](#schema-flakytaskresponse-property-links) (required) | [`FlakyTaskLinksResponse`](#schema-FlakyTaskLinksResponse) | GET URLs for this metric's related data. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The metric's 24-character hexadecimal public identifier. Use it as metricId to list contributing executions.",
      "title": "String"
    },
    "project": {
      "type": "string",
      "description": "The Nx project name for this window.",
      "title": "String"
    },
    "target": {
      "type": "string",
      "description": "The Nx target name for this window.",
      "title": "String"
    },
    "configuration": {
      "type": [
        "null",
        "string"
      ],
      "description": "The Nx target configuration shared by this window's observations; absent when not specified. Different configurations have separate metric windows.",
      "title": "String"
    },
    "windowStart": {
      "type": "string",
      "format": "date-time",
      "description": "The inclusive window start at UTC midnight. Observations use task start times.",
      "title": "String"
    },
    "windowEnd": {
      "type": "string",
      "format": "date-time",
      "description": "The exclusive window end at the next UTC midnight. Today's window changes until it ends.",
      "title": "String"
    },
    "flakinessRate": {
      "type": "number",
      "format": "double",
      "description": "Successful cache-miss observations for input hashes that have both successes and failures within this window, divided by all successful cache-miss observations. A fraction from 0 to 1, not a percentage or the fraction of failed attempts.",
      "maximum": 1,
      "minimum": 0,
      "title": "Double"
    },
    "sampleSizeFlakinessRate": {
      "type": "integer",
      "format": "int32",
      "description": "The denominator of flakinessRate: all successful cache-miss observations, not all attempts or unique runs. Use it to assess the amount of data behind the rate.",
      "title": "Int"
    },
    "totalReruns": {
      "type": "integer",
      "format": "int32",
      "description": "The number of cache-miss observations beyond the first for each task input hash in this window. Includes hashes with no mixed results. Not the number of runs that retried.",
      "title": "Int"
    },
    "deflakedAutomatically": {
      "type": "integer",
      "format": "int32",
      "description": "Counts a task input hash once per Nx execution if it has both successful and failed cache-miss attempts. One execution can count for multiple hashes. Does not establish attempt order or a successful final attempt. Attempts without an execution identifier can also contribute; they do not confirm a shared execution.",
      "title": "Int"
    },
    "isCacheable": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether Nx marked this window's tasks as cacheable. True, false, and unknown values have separate metric windows; absent means unknown, not false.",
      "title": "Boolean"
    },
    "links": {
      "$ref": "#/components/schemas/FlakyTaskLinksResponse",
      "description": "GET URLs for this metric's related data."
    }
  },
  "required": [
    "deflakedAutomatically",
    "flakinessRate",
    "id",
    "links",
    "project",
    "sampleSizeFlakinessRate",
    "target",
    "totalReruns",
    "windowEnd",
    "windowStart"
  ],
  "title": "FlakyTaskResponse"
}
```

</details>

<a id="schema-FlakyTaskLinksResponse"></a>

### FlakyTaskLinksResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-flakytasklinksresponse-property-executions"></a>[`executions`](#schema-flakytasklinksresponse-property-executions) (required) | `string` | The relative GET URL for paginated contributing distributed executions, not only mixed-result executions. Observations without an execution identifier affect metrics but do not appear in this list. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "executions": {
      "type": "string",
      "description": "The relative GET URL for paginated contributing distributed executions, not only mixed-result executions. Observations without an execution identifier affect metrics but do not appear in this list.",
      "title": "String"
    }
  },
  "required": [
    "executions"
  ],
  "title": "FlakyTaskLinksResponse"
}
```

</details>

<a id="schema-PageResponse_FlakyTaskResponse"></a>

### PageResponse_FlakyTaskResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_flakytaskresponse-property-items"></a>[`items`](#schema-pageresponse_flakytaskresponse-property-items) (required) | [`FlakyTaskResponse[]`](#schema-FlakyTaskResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_flakytaskresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_flakytaskresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_flakytaskresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_flakytaskresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/FlakyTaskResponse"
      },
      "title": "ArrayList_FlakyTaskResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_FlakyTaskResponse"
}
```

</details>

<a id="schema-FlakyTaskExecutionResponse"></a>

### FlakyTaskExecutionResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-flakytaskexecutionresponse-property-id"></a>[`id`](#schema-flakytaskexecutionresponse-property-id) (required) | `string` | The distributed Nx execution identifier for this entry's cache-miss observations, not the CI pipeline's ciExecutionId or the metric's id. Follow links.run to access its run. |
| <a id="schema-flakytaskexecutionresponse-property-createdat"></a>[`createdAt`](#schema-flakytaskexecutionresponse-property-createdat) (required) | `string` (`date-time`) | The latest cache-miss observation time for this execution in this window, in UTC. Not the run creation time. |
| <a id="schema-flakytaskexecutionresponse-property-links"></a>[`links`](#schema-flakytaskexecutionresponse-property-links) (required) | [`FlakyTaskExecutionLinksResponse`](#schema-FlakyTaskExecutionLinksResponse) | GET URLs for the contributing run and its matching task rows. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The distributed Nx execution identifier for this entry's cache-miss observations, not the CI pipeline's ciExecutionId or the metric's id. Follow links.run to access its run.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "The latest cache-miss observation time for this execution in this window, in UTC. Not the run creation time.",
      "title": "String"
    },
    "links": {
      "$ref": "#/components/schemas/FlakyTaskExecutionLinksResponse",
      "description": "GET URLs for the contributing run and its matching task rows."
    }
  },
  "required": [
    "createdAt",
    "id",
    "links"
  ],
  "title": "FlakyTaskExecutionResponse"
}
```

</details>

<a id="schema-FlakyTaskExecutionLinksResponse"></a>

### FlakyTaskExecutionLinksResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-flakytaskexecutionlinksresponse-property-run"></a>[`run`](#schema-flakytaskexecutionlinksresponse-property-run) (required) | `string` | The relative GET URL for the contributing run. |
| <a id="schema-flakytaskexecutionlinksresponse-property-tasks"></a>[`tasks`](#schema-flakytaskexecutionlinksresponse-property-tasks) (required) | `string` | The relative GET URL for the run's tasks, filtered to this metric's task definition. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "run": {
      "type": "string",
      "description": "The relative GET URL for the contributing run.",
      "title": "String"
    },
    "tasks": {
      "type": "string",
      "description": "The relative GET URL for the run's tasks, filtered to this metric's task definition.",
      "title": "String"
    }
  },
  "required": [
    "run",
    "tasks"
  ],
  "title": "FlakyTaskExecutionLinksResponse"
}
```

</details>

<a id="schema-PageResponse_FlakyTaskExecutionResponse"></a>

### PageResponse_FlakyTaskExecutionResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_flakytaskexecutionresponse-property-items"></a>[`items`](#schema-pageresponse_flakytaskexecutionresponse-property-items) (required) | [`FlakyTaskExecutionResponse[]`](#schema-FlakyTaskExecutionResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_flakytaskexecutionresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_flakytaskexecutionresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_flakytaskexecutionresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_flakytaskexecutionresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/FlakyTaskExecutionResponse"
      },
      "title": "ArrayList_FlakyTaskExecutionResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_FlakyTaskExecutionResponse"
}
```

</details>

<a id="schema-SelfHealingFixResponse"></a>

### SelfHealingFixResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-selfhealingfixresponse-property-id"></a>[`id`](#schema-selfhealingfixresponse-property-id) (required) | `string` | The fix identifier: 24 hexadecimal characters. |
| <a id="schema-selfhealingfixresponse-property-createdat"></a>[`createdAt`](#schema-selfhealingfixresponse-property-createdat) (required) | `string` (`date-time`) | When the fix record was created, in UTC. |
| <a id="schema-selfhealingfixresponse-property-updatedat"></a>[`updatedAt`](#schema-selfhealingfixresponse-property-updatedat) | `null` or `string` (`date-time`) | The last recorded update time, in UTC; absent when the record was never updated. |
| <a id="schema-selfhealingfixresponse-property-cipeid"></a>[`cipeId`](#schema-selfhealingfixresponse-property-cipeid) | `null` or `string` | The CI pipeline execution the fix belongs to; absent on records stored without it. |
| <a id="schema-selfhealingfixresponse-property-ciexecutionid"></a>[`ciExecutionId`](#schema-selfhealingfixresponse-property-ciexecutionid) (required) | `string` | The execution identifier supplied by the CI integration. |
| <a id="schema-selfhealingfixresponse-property-rungroup"></a>[`runGroup`](#schema-selfhealingfixresponse-property-rungroup) (required) | `string` | The id of the run group whose failed tasks the fix was created for. |
| <a id="schema-selfhealingfixresponse-property-suggestedfixstatus"></a>[`suggestedFixStatus`](#schema-selfhealingfixresponse-property-suggestedfixstatus) (required) | `string` | The state of fix generation: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT or CANCELED. |
| <a id="schema-selfhealingfixresponse-property-suggestedfixfailurereason"></a>[`suggestedFixFailureReason`](#schema-selfhealingfixresponse-property-suggestedfixfailurereason) | `null` or `string` | Why fix generation failed, when recorded. |
| <a id="schema-selfhealingfixresponse-property-suggestedfixfailurereasontype"></a>[`suggestedFixFailureReasonType`](#schema-selfhealingfixresponse-property-suggestedfixfailurereasontype) | `null` or `string` | The recorded category of the generation failure, when recorded. |
| <a id="schema-selfhealingfixresponse-property-verificationstatus"></a>[`verificationStatus`](#schema-selfhealingfixresponse-property-verificationstatus) (required) | `string` | The state of verifying the fix by re-running tasks with it applied: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT or CANCELED. |
| <a id="schema-selfhealingfixresponse-property-failureclassification"></a>[`failureClassification`](#schema-selfhealingfixresponse-property-failureclassification) | `null` or `string` | How the failure was classified: code_change, environment_state or flaky_task; absent until classified. |
| <a id="schema-selfhealingfixresponse-property-suggestedfixdescription"></a>[`suggestedFixDescription`](#schema-selfhealingfixresponse-property-suggestedfixdescription) | `null` or `string` | A short description of the suggested change; absent until one is suggested. |
| <a id="schema-selfhealingfixresponse-property-suggestedfixreasoning"></a>[`suggestedFixReasoning`](#schema-selfhealingfixresponse-property-suggestedfixreasoning) | `null` or `string` | The reasoning recorded with the suggested change; absent until one is suggested. |
| <a id="schema-selfhealingfixresponse-property-confidence"></a>[`confidence`](#schema-selfhealingfixresponse-property-confidence) | `null` or `integer` (`int32`) | The recorded confidence in the fix, when recorded. |
| <a id="schema-selfhealingfixresponse-property-confidencereasoning"></a>[`confidenceReasoning`](#schema-selfhealingfixresponse-property-confidencereasoning) | `null` or `string` | The reasoning behind the recorded confidence, when recorded. |
| <a id="schema-selfhealingfixresponse-property-suggestedfix"></a>[`suggestedFix`](#schema-selfhealingfixresponse-property-suggestedfix) | `null` or `string` | The suggested change as a git patch. Returned when a fix is fetched by id; never present in a list. |
| <a id="schema-selfhealingfixresponse-property-suggestedat"></a>[`suggestedAt`](#schema-selfhealingfixresponse-property-suggestedat) | `null` or `string` (`date-time`) | When the change was suggested, in UTC. |
| <a id="schema-selfhealingfixresponse-property-verifiedat"></a>[`verifiedAt`](#schema-selfhealingfixresponse-property-verifiedat) | `null` or `string` (`date-time`) | When verification finished, in UTC. |
| <a id="schema-selfhealingfixresponse-property-useraction"></a>[`userAction`](#schema-selfhealingfixresponse-property-useraction) (required) | `string` | What was done with the fix: NONE, APPLIED, REJECTED, APPLIED_LOCALLY, APPLIED_AUTOMATICALLY, REVERTED or RERUN_REQUESTED. |
| <a id="schema-selfhealingfixresponse-property-useractionorigin"></a>[`userActionOrigin`](#schema-selfhealingfixresponse-property-useractionorigin) | `null` or `string` | Where the action came from: NX_CLOUD_APP, NX_CONSOLE_VSCODE, NX_CONSOLE_INTELLIJ, NX_CLI, VCS_COMMENT or NX_MCP; absent when no action was recorded. |
| <a id="schema-selfhealingfixresponse-property-useractionrecordedat"></a>[`userActionRecordedAt`](#schema-selfhealingfixresponse-property-useractionrecordedat) | `null` or `string` (`date-time`) | When the action was recorded, in UTC. |
| <a id="schema-selfhealingfixresponse-property-commitsha"></a>[`commitSha`](#schema-selfhealingfixresponse-property-commitsha) | `null` or `string` | The commit that applied the fix to the branch, when recorded. |
| <a id="schema-selfhealingfixresponse-property-fixapplicationattempts"></a>[`fixApplicationAttempts`](#schema-selfhealingfixresponse-property-fixapplicationattempts) | [`SelfHealingFixApplicationAttemptResponse[]`](#schema-SelfHealingFixApplicationAttemptResponse) | The recorded attempts to apply the fix, oldest first. |
| <a id="schema-selfhealingfixresponse-property-autoapplyskipped"></a>[`autoApplySkipped`](#schema-selfhealingfixresponse-property-autoapplyskipped) | `null` or `boolean` | Whether applying the fix automatically was skipped; absent when not recorded. |
| <a id="schema-selfhealingfixresponse-property-autoapplyskipreason"></a>[`autoApplySkipReason`](#schema-selfhealingfixresponse-property-autoapplyskipreason) | `null` or `string` | Why applying the fix automatically was skipped, when recorded. |
| <a id="schema-selfhealingfixresponse-property-autoappliedtasks"></a>[`autoAppliedTasks`](#schema-selfhealingfixresponse-property-autoappliedtasks) | `null` or `string[]` | The ids of the tasks whose fix was applied automatically, when recorded. |
| <a id="schema-selfhealingfixresponse-property-flakyrerunpending"></a>[`flakyRerunPending`](#schema-selfhealingfixresponse-property-flakyrerunpending) | `null` or `boolean` | Whether a rerun of a flaky failure is waiting for the pipeline to finish; absent when not recorded. A rerun is an empty commit pushed to the branch. |
| <a id="schema-selfhealingfixresponse-property-flakyrerunskipped"></a>[`flakyRerunSkipped`](#schema-selfhealingfixresponse-property-flakyrerunskipped) | `null` or `boolean` | Whether the rerun of a flaky failure was skipped because the branch reached its rerun limit; absent when not recorded. |
| <a id="schema-selfhealingfixresponse-property-branchisoutdated"></a>[`branchIsOutdated`](#schema-selfhealingfixresponse-property-branchisoutdated) (required) | `boolean` | Whether the branch has moved on since the fix was created, so the fix no longer applies to its head. |
| <a id="schema-selfhealingfixresponse-property-fixtasks"></a>[`fixTasks`](#schema-selfhealingfixresponse-property-fixtasks) | [`SelfHealingFixTaskResponse[]`](#schema-SelfHealingFixTaskResponse) | The failed tasks the fix was created for. |
| <a id="schema-selfhealingfixresponse-property-fixedtasks"></a>[`fixedTasks`](#schema-selfhealingfixresponse-property-fixedtasks) | `string[]` | The ids of the tasks the suggested change is meant to fix. |
| <a id="schema-selfhealingfixresponse-property-otherfailedtasks"></a>[`otherFailedTasks`](#schema-selfhealingfixresponse-property-otherfailedtasks) | `null` or `string[]` | The ids of failed tasks the suggested change does not address, when recorded. |
| <a id="schema-selfhealingfixresponse-property-verificationtasksexecuted"></a>[`verificationTasksExecuted`](#schema-selfhealingfixresponse-property-verificationtasksexecuted) | `null` or `string[]` | The ids of the tasks re-run to verify the fix, when recorded. |
| <a id="schema-selfhealingfixresponse-property-remotetasksummary"></a>[`remoteTaskSummary`](#schema-selfhealingfixresponse-property-remotetasksummary) | `null` or `string` | A summary of the failing tasks' output from CI, when recorded. |
| <a id="schema-selfhealingfixresponse-property-localtasksummary"></a>[`localTaskSummary`](#schema-selfhealingfixresponse-property-localtasksummary) | `null` or `string` | A summary of the tasks' output from the fix's own run, when recorded. |
| <a id="schema-selfhealingfixresponse-property-shortlink"></a>[`shortLink`](#schema-selfhealingfixresponse-property-shortlink) | `null` or `string` | The short code that identifies this fix to `nx-cloud apply-locally`; absent until a change is suggested. |
| <a id="schema-selfhealingfixresponse-property-links"></a>[`links`](#schema-selfhealingfixresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs: self addresses this fix, with its patch; runGroup and cipe address its parents. cipe is absent on records stored without a CIPE id. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The fix identifier: 24 hexadecimal characters.",
      "title": "String"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the fix record was created, in UTC.",
      "title": "String"
    },
    "updatedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "The last recorded update time, in UTC; absent when the record was never updated.",
      "title": "String"
    },
    "cipeId": {
      "type": [
        "null",
        "string"
      ],
      "description": "The CI pipeline execution the fix belongs to; absent on records stored without it.",
      "title": "String"
    },
    "ciExecutionId": {
      "type": "string",
      "description": "The execution identifier supplied by the CI integration.",
      "title": "String"
    },
    "runGroup": {
      "type": "string",
      "description": "The id of the run group whose failed tasks the fix was created for.",
      "title": "String"
    },
    "suggestedFixStatus": {
      "type": "string",
      "description": "The state of fix generation: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT or CANCELED.",
      "title": "String"
    },
    "suggestedFixFailureReason": {
      "type": [
        "null",
        "string"
      ],
      "description": "Why fix generation failed, when recorded.",
      "title": "String"
    },
    "suggestedFixFailureReasonType": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded category of the generation failure, when recorded.",
      "title": "String"
    },
    "verificationStatus": {
      "type": "string",
      "description": "The state of verifying the fix by re-running tasks with it applied: NOT_STARTED, IN_PROGRESS, COMPLETED, FAILED, TIMED_OUT or CANCELED.",
      "title": "String"
    },
    "failureClassification": {
      "type": [
        "null",
        "string"
      ],
      "description": "How the failure was classified: code_change, environment_state or flaky_task; absent until classified.",
      "title": "String"
    },
    "suggestedFixDescription": {
      "type": [
        "null",
        "string"
      ],
      "description": "A short description of the suggested change; absent until one is suggested.",
      "title": "String"
    },
    "suggestedFixReasoning": {
      "type": [
        "null",
        "string"
      ],
      "description": "The reasoning recorded with the suggested change; absent until one is suggested.",
      "title": "String"
    },
    "confidence": {
      "type": [
        "null",
        "integer"
      ],
      "format": "int32",
      "description": "The recorded confidence in the fix, when recorded.",
      "title": "Int"
    },
    "confidenceReasoning": {
      "type": [
        "null",
        "string"
      ],
      "description": "The reasoning behind the recorded confidence, when recorded.",
      "title": "String"
    },
    "suggestedFix": {
      "type": [
        "null",
        "string"
      ],
      "description": "The suggested change as a git patch. Returned when a fix is fetched by id; never present in a list.",
      "title": "String"
    },
    "suggestedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "When the change was suggested, in UTC.",
      "title": "String"
    },
    "verifiedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "When verification finished, in UTC.",
      "title": "String"
    },
    "userAction": {
      "type": "string",
      "description": "What was done with the fix: NONE, APPLIED, REJECTED, APPLIED_LOCALLY, APPLIED_AUTOMATICALLY, REVERTED or RERUN_REQUESTED.",
      "title": "String"
    },
    "userActionOrigin": {
      "type": [
        "null",
        "string"
      ],
      "description": "Where the action came from: NX_CLOUD_APP, NX_CONSOLE_VSCODE, NX_CONSOLE_INTELLIJ, NX_CLI, VCS_COMMENT or NX_MCP; absent when no action was recorded.",
      "title": "String"
    },
    "userActionRecordedAt": {
      "type": [
        "null",
        "string"
      ],
      "format": "date-time",
      "description": "When the action was recorded, in UTC.",
      "title": "String"
    },
    "commitSha": {
      "type": [
        "null",
        "string"
      ],
      "description": "The commit that applied the fix to the branch, when recorded.",
      "title": "String"
    },
    "fixApplicationAttempts": {
      "type": "array",
      "description": "The recorded attempts to apply the fix, oldest first.",
      "items": {
        "$ref": "#/components/schemas/SelfHealingFixApplicationAttemptResponse"
      },
      "title": "ArrayList_SelfHealingFixApplicationAttemptResponse"
    },
    "autoApplySkipped": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether applying the fix automatically was skipped; absent when not recorded.",
      "title": "Boolean"
    },
    "autoApplySkipReason": {
      "type": [
        "null",
        "string"
      ],
      "description": "Why applying the fix automatically was skipped, when recorded.",
      "title": "String"
    },
    "autoAppliedTasks": {
      "type": [
        "null",
        "array"
      ],
      "description": "The ids of the tasks whose fix was applied automatically, when recorded.",
      "items": {
        "type": "string",
        "title": "String"
      },
      "title": "ArrayList_String"
    },
    "flakyRerunPending": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether a rerun of a flaky failure is waiting for the pipeline to finish; absent when not recorded. A rerun is an empty commit pushed to the branch.",
      "title": "Boolean"
    },
    "flakyRerunSkipped": {
      "type": [
        "null",
        "boolean"
      ],
      "description": "Whether the rerun of a flaky failure was skipped because the branch reached its rerun limit; absent when not recorded.",
      "title": "Boolean"
    },
    "branchIsOutdated": {
      "type": "boolean",
      "description": "Whether the branch has moved on since the fix was created, so the fix no longer applies to its head.",
      "title": "Boolean"
    },
    "fixTasks": {
      "type": "array",
      "description": "The failed tasks the fix was created for.",
      "items": {
        "$ref": "#/components/schemas/SelfHealingFixTaskResponse"
      },
      "title": "ArrayList_SelfHealingFixTaskResponse"
    },
    "fixedTasks": {
      "type": "array",
      "description": "The ids of the tasks the suggested change is meant to fix.",
      "items": {
        "type": "string",
        "title": "String"
      },
      "title": "ArrayList_String"
    },
    "otherFailedTasks": {
      "type": [
        "null",
        "array"
      ],
      "description": "The ids of failed tasks the suggested change does not address, when recorded.",
      "items": {
        "type": "string",
        "title": "String"
      },
      "title": "ArrayList_String"
    },
    "verificationTasksExecuted": {
      "type": [
        "null",
        "array"
      ],
      "description": "The ids of the tasks re-run to verify the fix, when recorded.",
      "items": {
        "type": "string",
        "title": "String"
      },
      "title": "ArrayList_String"
    },
    "remoteTaskSummary": {
      "type": [
        "null",
        "string"
      ],
      "description": "A summary of the failing tasks' output from CI, when recorded.",
      "title": "String"
    },
    "localTaskSummary": {
      "type": [
        "null",
        "string"
      ],
      "description": "A summary of the tasks' output from the fix's own run, when recorded.",
      "title": "String"
    },
    "shortLink": {
      "type": [
        "null",
        "string"
      ],
      "description": "The short code that identifies this fix to `nx-cloud apply-locally`; absent until a change is suggested.",
      "title": "String"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs: self addresses this fix, with its patch; runGroup and cipe address its parents. cipe is absent on records stored without a CIPE id.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "branchIsOutdated",
    "ciExecutionId",
    "createdAt",
    "id",
    "links",
    "runGroup",
    "suggestedFixStatus",
    "userAction",
    "verificationStatus"
  ],
  "title": "SelfHealingFixResponse"
}
```

</details>

<a id="schema-SelfHealingFixApplicationAttemptResponse"></a>

### SelfHealingFixApplicationAttemptResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-selfhealingfixapplicationattemptresponse-property-attemptedat"></a>[`attemptedAt`](#schema-selfhealingfixapplicationattemptresponse-property-attemptedat) (required) | `string` (`date-time`) | When the attempt was made, in UTC. |
| <a id="schema-selfhealingfixapplicationattemptresponse-property-attempttype"></a>[`attemptType`](#schema-selfhealingfixapplicationattemptresponse-property-attempttype) (required) | `string` | The kind of application attempted: APPLIED, APPLIED_LOCALLY, APPLIED_AUTOMATICALLY, REVERTED or another recorded action. |
| <a id="schema-selfhealingfixapplicationattemptresponse-property-success"></a>[`success`](#schema-selfhealingfixapplicationattemptresponse-property-success) (required) | `boolean` | Whether the attempt succeeded. |
| <a id="schema-selfhealingfixapplicationattemptresponse-property-errormessage"></a>[`errorMessage`](#schema-selfhealingfixapplicationattemptresponse-property-errormessage) | `null` or `string` | The recorded error of a failed attempt. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "attemptedAt": {
      "type": "string",
      "format": "date-time",
      "description": "When the attempt was made, in UTC.",
      "title": "String"
    },
    "attemptType": {
      "type": "string",
      "description": "The kind of application attempted: APPLIED, APPLIED_LOCALLY, APPLIED_AUTOMATICALLY, REVERTED or another recorded action.",
      "title": "String"
    },
    "success": {
      "type": "boolean",
      "description": "Whether the attempt succeeded.",
      "title": "Boolean"
    },
    "errorMessage": {
      "type": [
        "null",
        "string"
      ],
      "description": "The recorded error of a failed attempt.",
      "title": "String"
    }
  },
  "required": [
    "attemptType",
    "attemptedAt",
    "success"
  ],
  "title": "SelfHealingFixApplicationAttemptResponse"
}
```

</details>

<a id="schema-SelfHealingFixTaskResponse"></a>

### SelfHealingFixTaskResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-selfhealingfixtaskresponse-property-taskid"></a>[`taskId`](#schema-selfhealingfixtaskresponse-property-taskid) (required) | `string` | The task identifier, as in the task lists. For an `nx-cloud record` run, the recorded command. |
| <a id="schema-selfhealingfixtaskresponse-property-runid"></a>[`runId`](#schema-selfhealingfixtaskresponse-property-runid) | `null` or `string` | The id of the run the task failed in; for a task run by an agent, the distributed run that holds it. Absent when not recorded. |
| <a id="schema-selfhealingfixtaskresponse-property-links"></a>[`links`](#schema-selfhealingfixtaskresponse-property-links) (required) | Dictionary of `string` | Relative GET URLs for the task and its run; empty when the run was not recorded. An `nx-cloud record` run has only its run link. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "The task identifier, as in the task lists. For an `nx-cloud record` run, the recorded command.",
      "title": "String"
    },
    "runId": {
      "type": [
        "null",
        "string"
      ],
      "description": "The id of the run the task failed in; for a task run by an agent, the distributed run that holds it. Absent when not recorded.",
      "title": "String"
    },
    "links": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "title": "String"
      },
      "description": "Relative GET URLs for the task and its run; empty when the run was not recorded. An `nx-cloud record` run has only its run link.",
      "title": "LinkedHashMap_String-String"
    }
  },
  "required": [
    "links",
    "taskId"
  ],
  "title": "SelfHealingFixTaskResponse"
}
```

</details>

<a id="schema-PageResponse_SelfHealingFixResponse"></a>

### PageResponse_SelfHealingFixResponse

Type: `object`. 

| Property | Type | Description |
| --- | --- | --- |
| <a id="schema-pageresponse_selfhealingfixresponse-property-items"></a>[`items`](#schema-pageresponse_selfhealingfixresponse-property-items) (required) | [`SelfHealingFixResponse[]`](#schema-SelfHealingFixResponse) | The records in this page, in the requested sort order. |
| <a id="schema-pageresponse_selfhealingfixresponse-property-nextcursor"></a>[`nextCursor`](#schema-pageresponse_selfhealingfixresponse-property-nextcursor) | `null` or `string` | An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists. |
| <a id="schema-pageresponse_selfhealingfixresponse-property-prevcursor"></a>[`prevCursor`](#schema-pageresponse_selfhealingfixresponse-property-prevcursor) | `null` or `string` | An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists. |

<details>
<summary>Schema definition</summary>

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "The records in this page, in the requested sort order.",
      "items": {
        "$ref": "#/components/schemas/SelfHealingFixResponse"
      },
      "title": "ArrayList_SelfHealingFixResponse"
    },
    "nextCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the next page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no next page exists.",
      "title": "String"
    },
    "prevCursor": {
      "type": [
        "null",
        "string"
      ],
      "description": "An opaque token for the previous page of this list. Pass it unchanged as cursor with the same filters. Null or absent when no previous page exists.",
      "title": "String"
    }
  },
  "required": [
    "items"
  ],
  "title": "PageResponse_SelfHealingFixResponse"
}
```

</details>