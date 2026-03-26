const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8890;
const GATEWAY_URL = 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = '442701bc2b50a270e2405ec7cb5b7ea2a8fb44695d8e9f84';

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Proxy /v1/chat/completions to Gateway
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const resp = await fetch(GATEWAY_URL + '/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + GATEWAY_TOKEN
                    },
                    body: body
                });
                const data = await resp.text();
                res.writeHead(resp.status, { 'Content-Type': 'application/json' });
                res.end(data);
            } catch (err) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Gateway unreachable: ' + err.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
    };

    try {
        const content = fs.readFileSync(filePath);
        // Inject API config into HTML
        let out = content;
        if (ext === '.html') {
            out = content.toString()
                .replace("window.__OPENCLAW_API_URL || ''", "''")  // proxy is same origin
                .replace("window.__OPENCLAW_API_TOKEN || ''", "''");  // no token needed, server proxies
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(out);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));
