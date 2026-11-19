export const nestedOverridesBunLock = `{
  "lockfileVersion": 3,
  "configVersion": 1,
  "workspaces": {
    "": {
      "name": "nested-overrides-test",
      "dependencies": {
        "no-deps": "^1.0.0",
        "one-dep": "1.0.0",
        "one-range-dep": "1.0.0",
      },
    },
  },
  "overrides": {
    "no-deps": "1.0.0",
    "one-dep": {
      "no-deps": "1.1.0",
    },
    "one-range-dep@1": {
      "no-deps": "2.0.0",
    },
  },
  "packages": {
    "no-deps": ["no-deps@1.0.0", "", {}, "sha512-bZHeZtYQ1B4+5Q63vqR9g4FVFzey+1a1C5+6wl7safsxYFjbj9NmdaNVerRMe/JUphEqCYGwtPb3+KNFV43fWg=="],

    "one-dep": ["one-dep@1.0.0", "", { "dependencies": { "no-deps": "^1.0.0" } }, "sha512-sGcdTtQXj1MQI8I++jPF9CGsnwspI7kT0YbTHEafsVSpZFp+egbX79nGYPRxWaQ4Fcf6kn6ICUP0HuvmqD4dmg=="],

    "one-range-dep": ["one-range-dep@1.0.0", "", { "dependencies": { "no-deps": "^1.0.0" } }, "sha512-2zT16vQWDgOvIlJm6jqOtO8m/E09MsDI4/pzoiMqoZkXbjWn14L+a2vkCt5YRL8VjTWxiwNlj57/mYVTRDzQQQ=="],

    "one-dep/no-deps": ["no-deps@1.1.0", "", {}, "sha512-p7NqnieYX5yUS3Ome71aXyOGaVHf0Oz/faJyqj748J0ZaOYjdcHSsfQBs1kOsTyGJ2PfQGEC4cyEQ959pKrNdw=="],

    "one-range-dep/no-deps": ["no-deps@2.0.0", "", {}, "sha512-wtc9qihjbFq2L0DGZq8Vg32HUZ+qQ9Pp4kFmhZNXrhp3tHol6YwDeVciMlwtZisUMjcplXGFsewbnBixOQnlZg=="],
  }
}`;
