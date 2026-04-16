const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = 3000;
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// Auto-detect local IP
function getLocalIP() {
  const nets = os.networkInterfaces();
  for(const name of Object.keys(nets)) {
    for(const net of nets[name]) {
      if(net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

http.createServer((req, res) => {
  // Strip query strings
  const urlPath = req.url.split('?')[0];
  let filePath = '.' + (urlPath === '/' ? '/index.html' : urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if(err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n✅ Servidor VentasPro corriendo\n');
  console.log('  PC:     http://localhost:' + PORT);
  console.log('  Movil:  http://' + ip + ':' + PORT);
  console.log('\n📱 Abre esa URL en el movil (mismo WiFi)');
  console.log('🔥 Firewall: netsh advfirewall firewall add rule name="CRM" dir=in action=allow protocol=TCP localport=' + PORT);
  console.log('\nCtrl+C para detener\n');
});
