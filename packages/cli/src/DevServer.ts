import httpProxy from 'http-proxy';
import * as fs from 'node:fs';
import * as http from 'node:http';

export interface ProxyConfigEntry
{
    target: string;
    changeOrigin?: boolean;
}

export type ProxyConfig = Record<string, ProxyConfigEntry>;

export interface DevServerOptions
{
    port: number;
    host: string;
    esbuildPort: number;
    esbuildHost: string;
    proxyConfig?: ProxyConfig;
}

export class DevServer
{
    private readonly options: DevServerOptions;
    private readonly proxy: httpProxy;
    private server: http.Server | null = null;

    public constructor(options: DevServerOptions)
    {
        this.options = options;
        this.proxy = httpProxy.createProxyServer({});

        this.proxy.on('error', (err, req, res) =>
        {
            console.error('Proxy error:', err.message);
            if (res instanceof http.ServerResponse && !res.headersSent)
            {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('Proxy error: ' + err.message);
            }
        });
    }

    public static loadProxyConfig(configPath: string): ProxyConfig | undefined
    {
        if (!fs.existsSync(configPath))
        {
            console.warn(`Proxy config not found: ${configPath}`);
            return undefined;
        }

        try
        {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config: unknown = JSON.parse(content);
            if (typeof config === 'object' && config !== null && !Array.isArray(config))
            {
                const result: ProxyConfig = {};
                for (const [key, value] of Object.entries(config))
                {
                    if (DevServer.isProxyEntry(value))
                    {
                        result[key] = {
                            target: value.target,
                            changeOrigin: typeof value.changeOrigin === 'boolean' ? value.changeOrigin : undefined
                        };
                    }
                }
                return result;
            }
            return undefined;
        }
        catch(err)
        {
            console.error('Failed to parse proxy config:', err);
            return undefined;
        }
    }

    private static isProxyEntry(value: unknown): value is { target: string; changeOrigin?: boolean }
    {
        return typeof value === 'object' &&
            value !== null &&
            'target' in value &&
            typeof (value as { target: unknown }).target === 'string';
    }

    public async start(): Promise<number>
    {
        return new Promise((resolve, reject) =>
        {
            this.server = http.createServer((req, res) =>
            {
                this.handleRequest(req, res);
            });

            this.server.on('error', (err) =>
            {
                reject(err);
            });

            this.server.listen(this.options.port, () =>
            {
                const address = this.server?.address();
                const port = typeof address === 'object' && address ? address.port : this.options.port;
                resolve(port);
            });
        });
    }

    public stop(): void
    {
        if (this.server)
        {
            this.server.close();
            this.server = null;
        }
        this.proxy.close();
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void
    {
        const url = req.url ?? '/';
        const [pathname] = url.split('?');

        const proxyEntry = this.findProxyEntry(pathname);
        if (proxyEntry)
        {
            this.proxyRequest(req, res, proxyEntry);
        }
        else
        {
            this.forwardToEsbuild(req, res);
        }
    }

    private findProxyEntry(pathname: string): ProxyConfigEntry | undefined
    {
        if (!this.options.proxyConfig)
        {
            return undefined;
        }

        for (const [pattern, entry] of Object.entries(this.options.proxyConfig))
        {
            if (pathname === pattern || pathname.startsWith(pattern + '/') || pathname.startsWith(pattern + '?'))
            {
                return entry;
            }
        }

        return undefined;
    }

    private proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, entry: ProxyConfigEntry): void
    {
        const options: httpProxy.ServerOptions = {
            target: entry.target,
            changeOrigin: entry.changeOrigin ?? false
        };

        this.proxy.web(req, res, options);
    }

    private forwardToEsbuild(req: http.IncomingMessage, res: http.ServerResponse): void
    {
        const options: httpProxy.ServerOptions = {
            target: `http://${this.options.esbuildHost}:${this.options.esbuildPort}`
        };

        this.proxy.web(req, res, options);
    }
}
