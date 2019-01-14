import { writeToFile } from '../utils/fileutils';
import * as graphviz from 'graphviz';
import * as opn from 'opn';
import { ProjectNode, ProjectType } from './affected-apps';
import * as yargs from 'yargs';

import { getProjectNodes, readAngularJson, readNxJson } from './shared';
import * as path from 'path';
import { tmpNameSync } from 'tmp';
import {
  Deps,
  DependencyType,
  Dependency,
  readDependencies
} from './deps-calculator';

const viz = require('viz.js'); // typings are incorrect in viz.js library - need to use `require`

export enum NodeEdgeVariant {
  default = 'default',
  highlighted = 'highlighted'
}

export type GraphvizOptions = {
  fontname?: string;
  fontsize?: number;
  shape?: string;
  color?: string;
  style?: string;
  fillcolor?: string;
};
export type AttrValue = {
  attr: string;
  value: boolean | number | string;
};

export type GraphvizOptionNodeEdge = {
  [key: string]: {
    [variant: string]: GraphvizOptions;
  };
};

export type GraphvizConfig = {
  graph: AttrValue[];
  nodes: GraphvizOptionNodeEdge;
  edges: GraphvizOptionNodeEdge;
};

export type ProjectMap = {
  [name: string]: ProjectNode;
};

export type CriticalPathMap = {
  [name: string]: boolean;
};

export enum OutputType {
  'json' = 'json',
  'html' = 'html',
  'dot' = 'dot',
  'svg' = 'svg'
}

export interface UserOptions extends yargs.Arguments {
  file?: string;
  output?: string;
}

type ParsedUserOptions = {
  isFilePresent?: boolean;
  filename?: string;
  type?: OutputType;
  output?: string;
  shouldOpen: boolean;
};

type OutputOptions = {
  data: string;
  shouldOpen: boolean;
  shouldWriteToFile: boolean;
  filename?: string;
};

type JSONOutput = {
  deps: Deps;
  criticalPath: string[];
};

const defaultConfig = {
  isFilePresent: false,
  filename: undefined,
  type: OutputType.html,
  shouldOpen: true
};

export const graphvizConfig: GraphvizConfig = {
  graph: [
    {
      attr: 'overlap',
      value: false
    },
    {
      attr: 'pad',
      value: 0.111
    }
  ],
  nodes: {
    [ProjectType.e2e]: {
      [NodeEdgeVariant.default]: {
        fontname: 'Arial',
        fontsize: 14,
        shape: 'box'
      },
      [NodeEdgeVariant.highlighted]: {
        fontname: 'Arial',
        fontsize: 14,
        shape: 'box',
        color: '#FF0033'
      }
    },
    [ProjectType.app]: {
      [NodeEdgeVariant.default]: {
        fontname: 'Arial',
        fontsize: 14,
        shape: 'box'
      },
      [NodeEdgeVariant.highlighted]: {
        fontname: 'Arial',
        fontsize: 14,
        shape: 'box',
        color: '#FF0033'
      }
    },
    [ProjectType.lib]: {
      [NodeEdgeVariant.default]: {
        fontname: 'Arial',
        fontsize: 14,
        style: 'filled',
        fillcolor: '#EFEFEF'
      },
      [NodeEdgeVariant.highlighted]: {
        fontname: 'Arial',
        fontsize: 14,
        style: 'filled',
        fillcolor: '#EFEFEF',
        color: '#FF0033'
      }
    }
  },
  edges: {
    [DependencyType.es6Import]: {
      [NodeEdgeVariant.default]: {
        color: '#757575'
      },
      [NodeEdgeVariant.highlighted]: {
        color: '#FF0033'
      }
    },
    [DependencyType.loadChildren]: {
      [NodeEdgeVariant.default]: {
        color: '#757575',
        style: 'dotted'
      },
      [NodeEdgeVariant.highlighted]: {
        color: '#FF0033',
        style: 'dotted'
      }
    },
    [DependencyType.implicit]: {
      [NodeEdgeVariant.default]: {
        color: '#000000',
        style: 'bold'
      },
      [NodeEdgeVariant.highlighted]: {
        color: '#FF0033',
        style: 'bold'
      }
    }
  }
};

function mapProjectNodes(projects: ProjectNode[]) {
  return projects.reduce((m, proj) => ({ ...m, [proj.name]: proj }), {});
}

function getVariant(map: CriticalPathMap, key: string) {
  return map[key] ? NodeEdgeVariant.highlighted : NodeEdgeVariant.default;
}

function getNodeProps(
  config: GraphvizOptionNodeEdge,
  projectNode: ProjectNode,
  criticalPath: CriticalPathMap
) {
  const nodeProps = config[projectNode.type];
  return nodeProps[getVariant(criticalPath, projectNode.name)];
}

function getEdgeProps(
  config: GraphvizOptionNodeEdge,
  depType: DependencyType,
  child: string,
  criticalPath: CriticalPathMap
) {
  const edgeProps = config[depType];
  return edgeProps[getVariant(criticalPath, child)];
}

export function createGraphviz(
  config: GraphvizConfig,
  deps: Deps,
  projects: ProjectNode[],
  criticalPath: CriticalPathMap
) {
  const projectMap: ProjectMap = mapProjectNodes(projects);
  const g = graphviz.digraph('G');

  config.graph.forEach(({ attr, value }) => g.set(attr, value));

  Object.keys(deps)
    .sort() // sorting helps with testing
    .forEach(key => {
      const projectNode = projectMap[key];
      const dependencies = deps[key];

      g.addNode(key, getNodeProps(config.nodes, projectNode, criticalPath));

      if (dependencies.length > 0) {
        dependencies.forEach((dep: Dependency) => {
          g.addNode(
            dep.projectName,
            getNodeProps(
              config.nodes,
              projectMap[dep.projectName],
              criticalPath
            )
          ); // child node

          g.addEdge(
            key,
            dep.projectName,
            getEdgeProps(config.edges, dep.type, dep.projectName, criticalPath)
          );
        });
      }
    });

  return g.to_dot();
}

function handleOutput({
  data,
  shouldOpen,
  shouldWriteToFile,
  filename
}: OutputOptions) {
  if (shouldOpen) {
    const tmpFilename = `${tmpNameSync()}.html`;
    writeToFile(tmpFilename, data);
    opn(tmpFilename, {
      wait: false
    });
  } else if (!shouldWriteToFile) {
    return console.log(data);
  } else {
    writeToFile(filename, data);
  }
}

function applyHTMLTemplate(svg: string) {
  return `<!DOCTYPE html>
  <html>
    <head><title></title></head>
    <body>${svg}</body>
  </html>
  `;
}

function generateGraphJson(
  projects: ProjectNode[],
  criticalPath?: string[]
): JSONOutput {
  const nxJson = readNxJson();
  const npmScope = nxJson.npmScope;

  // fetch all apps and libs
  const deps = readDependencies(npmScope, projects);

  return {
    deps,
    criticalPath
  };
}

function getDot(projects: ProjectNode[], json: JSONOutput) {
  return createGraphviz(
    graphvizConfig,
    json.deps,
    projects,
    json.criticalPath.reduce((m, proj) => ({ ...m, [proj]: true }), {})
  );
}

function getConfigFromUserInput(cmdOpts: UserOptions): ParsedUserOptions {
  const filename = cmdOpts.file;
  const output = cmdOpts.output;

  if (filename && output) {
    throw new Error(
      'Received both filename as well as output type. Please only specify one of the options.'
    );
  }

  const extension: OutputType = !!filename
    ? (path.extname(filename).substring(1) as OutputType)
    : (output as OutputType) || OutputType.html;
  return {
    isFilePresent: !output,
    type: extension,
    output: output,
    shouldOpen: !output && !filename,
    filename
  };
}

function extractDataFromJson(
  projects: ProjectNode[],
  json: { deps: Deps; criticalPath: string[] },
  type: OutputType
) {
  switch (type) {
    case OutputType.json:
      return JSON.stringify(json, null, 2);
    case OutputType.dot:
      return getDot(projects, json);
    case OutputType.html:
      return applyHTMLTemplate(viz(getDot(projects, json)));
    case OutputType.svg:
      return viz(getDot(projects, json));
    default:
      throw new Error(
        'Unrecognized file extension. Supported extensions are "json", "html", and "dot"'
      );
  }
}

export function generateGraph(
  args: UserOptions,
  criticalPath?: string[]
): void {
  const angularJson = readAngularJson();
  const nxJson = readNxJson();
  const projects: ProjectNode[] = getProjectNodes(angularJson, nxJson);
  const json = generateGraphJson(projects, criticalPath || []);

  const config = {
    ...defaultConfig,
    ...getConfigFromUserInput(args)
  };

  handleOutput({
    data: extractDataFromJson(projects, json, config.type),
    filename: config.filename,
    shouldWriteToFile: config.isFilePresent,
    shouldOpen: config.shouldOpen
  });
}
