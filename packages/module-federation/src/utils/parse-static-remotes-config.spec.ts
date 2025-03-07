import {
  parseStaticRemotesConfig,
  parseStaticSsrRemotesConfig,
} from './parse-static-remotes-config';

describe('parseStaticRemotesConfig', () => {
  it('should parse static remotes config', () => {
    const staticRemotes = ['remote1', 'remote2'];
    const context = {
      projectGraph: {
        nodes: {
          remote1: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'dist/remote1',
                  },
                },
                serve: {
                  options: {
                    port: 4200,
                  },
                },
              },
            },
          },
          remote2: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'dist/remote2',
                  },
                },
                serve: {
                  options: {
                    port: 4201,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(parseStaticRemotesConfig(staticRemotes, context as any)).toEqual({
      remotes: ['remote1', 'remote2'],
      config: {
        remote1: {
          basePath: 'dist',
          outputPath: 'dist/remote1',
          urlSegment: 'remote1',
          port: 4200,
        },
        remote2: {
          basePath: 'dist',
          outputPath: 'dist/remote2',
          urlSegment: 'remote2',
          port: 4201,
        },
      },
    });
  });
  it('should parse static remotes config when dist in project root', () => {
    const staticRemotes = ['remote1', 'remote2'];
    const context = {
      projectGraph: {
        nodes: {
          remote1: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'apps/remote1/dist',
                  },
                },
                serve: {
                  options: {
                    port: 4200,
                  },
                },
              },
            },
          },
          remote2: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'apps/remote2/dist',
                  },
                },
                serve: {
                  options: {
                    port: 4201,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(parseStaticRemotesConfig(staticRemotes, context as any)).toEqual({
      remotes: ['remote1', 'remote2'],
      config: {
        remote1: {
          basePath: 'apps/remote1',
          outputPath: 'apps/remote1/dist',
          urlSegment: 'remote1',
          port: 4200,
        },
        remote2: {
          basePath: 'apps/remote2',
          outputPath: 'apps/remote2/dist',
          urlSegment: 'remote2',
          port: 4201,
        },
      },
    });
  });
  it('should parse static remotes config when dist is root and different name', () => {
    const staticRemotes = ['remote1', 'remote2'];
    const context = {
      projectGraph: {
        nodes: {
          remote1: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'build',
                  },
                },
                serve: {
                  options: {
                    port: 4200,
                  },
                },
              },
            },
          },
          remote2: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'dist',
                  },
                },
                serve: {
                  options: {
                    port: 4201,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(parseStaticRemotesConfig(staticRemotes, context as any)).toEqual({
      remotes: ['remote1', 'remote2'],
      config: {
        remote1: {
          basePath: 'build',
          outputPath: 'build',
          urlSegment: 'remote1',
          port: 4200,
        },
        remote2: {
          basePath: 'dist',
          outputPath: 'dist',
          urlSegment: 'remote2',
          port: 4201,
        },
      },
    });
  });

  it('should parse ssr static remotes config', () => {
    const staticRemotes = ['remote1', 'remote2'];
    const context = {
      projectGraph: {
        nodes: {
          remote1: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'dist/remote1/browser',
                  },
                },
                serve: {
                  options: {
                    port: 4200,
                  },
                },
              },
            },
          },
          remote2: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'dist/remote2/browser',
                  },
                },
                serve: {
                  options: {
                    port: 4201,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(parseStaticSsrRemotesConfig(staticRemotes, context as any)).toEqual({
      remotes: ['remote1', 'remote2'],
      config: {
        remote1: {
          basePath: 'dist',
          outputPath: 'dist/remote1',
          urlSegment: 'remote1',
          port: 4200,
        },
        remote2: {
          basePath: 'dist',
          outputPath: 'dist/remote2',
          urlSegment: 'remote2',
          port: 4201,
        },
      },
    });
  });

  it('should parse ssr static remotes config when dist in project root', () => {
    const staticRemotes = ['remote1', 'remote2'];
    const context = {
      projectGraph: {
        nodes: {
          remote1: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'apps/remote1/dist/browser',
                  },
                },
                serve: {
                  options: {
                    port: 4200,
                  },
                },
              },
            },
          },
          remote2: {
            data: {
              targets: {
                build: {
                  options: {
                    outputPath: 'apps/remote2/dist/browser',
                  },
                },
                serve: {
                  options: {
                    port: 4201,
                  },
                },
              },
            },
          },
        },
      },
    };
    expect(parseStaticSsrRemotesConfig(staticRemotes, context as any)).toEqual({
      remotes: ['remote1', 'remote2'],
      config: {
        remote1: {
          basePath: 'apps/remote1',
          outputPath: 'apps/remote1/dist',
          urlSegment: 'remote1',
          port: 4200,
        },
        remote2: {
          basePath: 'apps/remote2',
          outputPath: 'apps/remote2/dist',
          urlSegment: 'remote2',
          port: 4201,
        },
      },
    });
  });
});
