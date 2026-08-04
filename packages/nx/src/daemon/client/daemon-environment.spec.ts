import { delimiter } from "node:path";
import {
  applyDaemonEnvFromClient,
  normalizeDaemonEnvironmentForGraph,
} from "./daemon-environment";

describe("normalizeDaemonEnvironmentForGraph", () => {
  it("treats per-invocation Berry folders as the same graph identity", () => {
    const basePath = ["/usr/local/share/dotnet", "/usr/bin"].join(delimiter);
    const firstBerry = "/tmp/xfs-first";
    const secondBerry = "/tmp/xfs-second";

    expect(
      normalizeDaemonEnvironmentForGraph({
        BERRY_BIN_FOLDER: firstBerry,
        PATH: [firstBerry, basePath].join(delimiter),
        DOTNET_ROOT: "/usr/local/share/dotnet",
      }),
    ).toEqual(
      normalizeDaemonEnvironmentForGraph({
        BERRY_BIN_FOLDER: secondBerry,
        PATH: [secondBerry, basePath].join(delimiter),
        DOTNET_ROOT: "/usr/local/share/dotnet",
      }),
    );
  });

  it("preserves real toolchain path changes", () => {
    const berry = "/tmp/xfs-command";
    const first = normalizeDaemonEnvironmentForGraph({
      BERRY_BIN_FOLDER: berry,
      PATH: [berry, "/sdk/dotnet-9", "/usr/bin"].join(delimiter),
    });
    const second = normalizeDaemonEnvironmentForGraph({
      BERRY_BIN_FOLDER: berry,
      PATH: [berry, "/sdk/dotnet-10", "/usr/bin"].join(delimiter),
    });

    expect(first.PATH).not.toEqual(second.PATH);
  });

  it("removes only path entries equal to the Berry folder", () => {
    const berry = "/tmp/xfs-command";
    const normalized = normalizeDaemonEnvironmentForGraph({
      BERRY_BIN_FOLDER: berry,
      PATH: [berry, `${berry}-tools`, "/usr/bin", berry].join(delimiter),
    });

    expect(normalized).toEqual({
      BERRY_BIN_FOLDER: "<YARN_BERRY_BIN_FOLDER>",
      PATH: [`${berry}-tools`, "/usr/bin"].join(delimiter),
    });
  });

  it("uses case-insensitive separator-normalized comparison on Windows", () => {
    const normalized = normalizeDaemonEnvironmentForGraph(
      {
        BERRY_BIN_FOLDER: "C:\\Temp\\XFS-Command",
        PATH: "c:/temp/xfs-command;C:\\Windows\\System32",
      },
      "win32",
    );

    expect(normalized).toEqual({
      BERRY_BIN_FOLDER: "<YARN_BERRY_BIN_FOLDER>",
      PATH: "C:\\Windows\\System32",
    });
  });

  it("keeps Yarn and direct invocation as different graph identities", () => {
    const berry = "/tmp/xfs-command";
    const yarnIdentity = normalizeDaemonEnvironmentForGraph({
      BERRY_BIN_FOLDER: berry,
      PATH: [berry, "/usr/bin"].join(delimiter),
    });
    const directIdentity = normalizeDaemonEnvironmentForGraph({
      PATH: "/usr/bin",
    });

    expect(yarnIdentity).not.toEqual(directIdentity);
  });

  it("forwards Berry runtime changes without changing graph identity", () => {
    const originalBerry = process.env.BERRY_BIN_FOLDER;
    const originalPath = process.env.PATH;
    const basePath = ["/usr/local/share/dotnet", "/usr/bin"].join(delimiter);

    try {
      process.env.BERRY_BIN_FOLDER = "/tmp/xfs-first";
      process.env.PATH = ["/tmp/xfs-first", basePath].join(delimiter);

      const changes = applyDaemonEnvFromClient({
        ...process.env,
        BERRY_BIN_FOLDER: "/tmp/xfs-second",
        PATH: ["/tmp/xfs-second", basePath].join(delimiter),
      });

      expect(changes.runtimeChangedKeys).toEqual(
        expect.arrayContaining(["BERRY_BIN_FOLDER", "PATH"]),
      );
      expect(changes.graphChangedKeys).toEqual([]);
      expect(process.env.BERRY_BIN_FOLDER).toBe("/tmp/xfs-second");
    } finally {
      if (originalBerry === undefined) {
        delete process.env.BERRY_BIN_FOLDER;
      } else {
        process.env.BERRY_BIN_FOLDER = originalBerry;
      }
      process.env.PATH = originalPath;
    }
  });

  it("reports real toolchain changes as graph identity changes", () => {
    const originalBerry = process.env.BERRY_BIN_FOLDER;
    const originalPath = process.env.PATH;

    try {
      process.env.BERRY_BIN_FOLDER = "/tmp/xfs-first";
      process.env.PATH = "/tmp/xfs-first:/sdk/dotnet-9:/usr/bin";

      const changes = applyDaemonEnvFromClient({
        ...process.env,
        BERRY_BIN_FOLDER: "/tmp/xfs-second",
        PATH: "/tmp/xfs-second:/sdk/dotnet-10:/usr/bin",
      });

      expect(changes.graphChangedKeys).toContain("PATH");
    } finally {
      if (originalBerry === undefined) {
        delete process.env.BERRY_BIN_FOLDER;
      } else {
        process.env.BERRY_BIN_FOLDER = originalBerry;
      }
      process.env.PATH = originalPath;
    }
  });

  it("does not remove PROJECT_CWD or INIT_CWD", () => {
    expect(
      normalizeDaemonEnvironmentForGraph({
        PROJECT_CWD: "/workspace",
        INIT_CWD: "/workspace/packages/app",
      }),
    ).toEqual({
      PROJECT_CWD: "/workspace",
      INIT_CWD: "/workspace/packages/app",
    });
  });
});
