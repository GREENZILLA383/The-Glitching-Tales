const http = require('http');

const server = http.createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/log') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log('--- ERROR LOG RECEIVED ---');
            console.log(body);
            console.log('--------------------------');
            res.writeHead(200);
            res.end('Logged');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(8081, () => {
    console.log('Error logger listening on port 8081...');
});
