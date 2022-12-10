import { StoreRunInformationLifeCycle } from './store-run-information-life-cycle';
describe('StoreRunInformationLifeCycle', () => {
  it('should create run details', () => {
    let runDetails;
    const store = new StoreRunInformationLifeCycle(
      'nx run-many --target=test',
      (res) => (runDetails = res),
      () => 'DATE'
    );

    store.startCommand();

    store.startTasks([
      { id: 'proj1:test' },
      { id: 'proj2:test' },
      { id: 'proj3:test' },
      { id: 'proj4:test' },
    ] as any);

    store.endTasks([
      {
        task: {
          id: 'proj1:test',
          target: { target: 'test', project: 'proj1' },
          hash: 'hash1',
        },
        status: 'remote-cache',
        code: 0,
      },
      {
        task: {
          id: 'proj2:test',
          target: { target: 'test', project: 'proj2' },
          hash: 'hash2',
        },
        status: 'local-cache',
        code: 0,
      },
      {
        task: {
          id: 'proj3:test',
          target: { target: 'test', project: 'proj3' },
          hash: 'hash3',
        },
        status: 'local-cache-kept-existing',
        code: 0,
      },
      {
        task: {
          id: 'proj4:test',
          target: { target: 'test', project: 'proj4' },
          hash: 'hash4',
        },
        status: 'cache-miss',
        code: 1,
      },
    ] as any);

    store.endCommand();

    expect(runDetails).toMatchInlineSnapshot(`
      Object {
        "run": Object {
          "command": "nx run-many --target=test",
          "endTime": "DATE",
          "inner": false,
          "startTime": "DATE",
        },
        "tasks": Array [
          Object {
            "cacheStatus": "remote-cache-hit",
            "endTime": "DATE",
            "hash": "hash1",
            "params": "",
            "projectName": "proj1",
            "startTime": "DATE",
            "status": 0,
            "target": "test",
            "taskId": "proj1:test",
          },
          Object {
            "cacheStatus": "local-cache-hit",
            "endTime": "DATE",
            "hash": "hash2",
            "params": "",
            "projectName": "proj2",
            "startTime": "DATE",
            "status": 0,
            "target": "test",
            "taskId": "proj2:test",
          },
          Object {
            "cacheStatus": "local-cache-hit",
            "endTime": "DATE",
            "hash": "hash3",
            "params": "",
            "projectName": "proj3",
            "startTime": "DATE",
            "status": 0,
            "target": "test",
            "taskId": "proj3:test",
          },
          Object {
            "cacheStatus": "cache-miss",
            "endTime": "DATE",
            "hash": "hash4",
            "params": "",
            "projectName": "proj4",
            "startTime": "DATE",
            "status": 1,
            "target": "test",
            "taskId": "proj4:test",
          },
        ],
      }
    `);
  });
});
