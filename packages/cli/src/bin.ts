#!/usr/bin/env node

import { Cli } from './Cli.js';

const { options, args } = Cli.parseArgs(process.argv.slice(2));
const cli = new Cli(options);

cli.run(args)
    .catch((error: unknown) =>
    {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exit(1);
    });
