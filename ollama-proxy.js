const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PROXY_PORT = 8081;

// Enable CORS for Chrome extensions
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin'],
  credentials: false
}));

// Parse JSON requests with increased limit for image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Proxy all requests to Ollama
app.use('/', createProxyMiddleware({
  target: 'http://localhost:11434',
  changeOrigin: true,
  timeout: 180000, // 3 minutes timeout
  proxyTimeout: 180000, // 3 minutes proxy timeout
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.path}`);
    
    // Remove problematic headers that might cause CORS issues
    proxyReq.removeHeader('origin');
    proxyReq.removeHeader('referer');
    
    // Set longer timeout for the request
    proxyReq.setTimeout(180000);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`Proxy response: ${proxyRes.statusCode} for ${req.method} ${req.path}`);
    
    // Ensure CORS headers are set on response
    proxyRes.headers['access-control-allow-origin'] = '*';
    proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, Origin';
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error: ' + err.message });
    }
  }
}));

app.listen(PROXY_PORT, () => {
  console.log(`🔄 Ollama CORS Proxy running on http://localhost:${PROXY_PORT}`);
  console.log(`📡 Proxying requests to http://localhost:11434`);
  console.log(`🌐 Chrome extensions can now access Ollama via this proxy`);
});

app.on('error', (err) => {
  console.error('Server error:', err);
});