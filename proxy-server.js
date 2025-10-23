const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8080;

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Serve static files from current directory
app.use(express.static('.'));

// Proxy endpoint for external websites
app.use('/proxy', createProxyMiddleware({
  target: 'https://www.google.com',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy': '', // remove /proxy from the path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Handle dynamic target based on URL parameter
    const targetUrl = req.query.url;
    if (targetUrl) {
      try {
        const url = new URL(targetUrl);
        proxyReq.path = url.pathname + url.search;
        proxyReq.setHeader('host', url.host);
      } catch (e) {
        console.error('Invalid URL:', targetUrl);
      }
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  }
}));

// API endpoint to fetch any URL (server-side)
app.get('/fetch-url', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const html = await response.text();
    
    // Inject base tag to handle relative URLs
    const modifiedHtml = html.replace(
      '<head>',
      `<head><base href="${targetUrl}">`
    );
    
    res.setHeader('Content-Type', 'text/html');
    res.send(modifiedHtml);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch URL' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Algorithm Mirror Server running at http://localhost:${PORT}`);
  console.log(`📱 Open the browser interface at http://localhost:${PORT}`);
  console.log(`🌐 Proxy enabled - you can now browse any website!`);
});