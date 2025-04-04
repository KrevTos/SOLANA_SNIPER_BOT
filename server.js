import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file 
dotenv.config();

// Get the directory name of the current module (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url); 
const __dirname = dirname(__filename);
 
// Create Express app
const app = express();

// Define port
const PORT = process.env.PORT || 3001;

// Define RPC endpoints
const SOLANA_RPC_ENDPOINTS = [
  // Public endpoints (no API key needed)
  { url: 'https://api.mainnet-beta.solana.com', apiKey: false },
  { url: 'https://solana-api.projectserum.com', apiKey: false },
  { url: 'https://rpc.ankr.com/solana', apiKey: false },
  { url: 'https://solana.nightly.app/rpc', apiKey: false },
  { url: 'https://solana-mainnet.g.alchemy.com/v2/demo', apiKey: false },
  
  // Private endpoints (API key required - add your own endpoints here)
  // { url: 'https://your-private-rpc-url.com', apiKey: 'YOUR_API_KEY' },
];

// Middleware
app.use(express.json()); // For parsing JSON request bodies
app.use(cors()); // Enable CORS for all routes

// Middleware to count requests
let requestCounter = 0;
app.use((req, res, next) => {
  requestCounter++;
  console.log(`Request #${requestCounter}: ${req.method} ${req.path}`);
  next();
});

// Simple rate limiting middleware
const rateLimitRequests = {};
app.use((req, res, next) => {
  const ip = req.ip;
  if (!rateLimitRequests[ip]) {
    rateLimitRequests[ip] = [];
  }
  
  // Clean up old requests
  const now = Date.now();
  rateLimitRequests[ip] = rateLimitRequests[ip].filter(time => now - time < 60000); // Keep only requests from the last minute
  
  // Check rate limit (100 requests per minute)
  if (rateLimitRequests[ip].length >= 100) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }
  
  // Add current request
  rateLimitRequests[ip].push(now);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Proxy endpoint for Solana RPC calls
app.post('/solana-rpc', async (req, res) => {
  try {
    // Get a random RPC endpoint
    const endpoint = SOLANA_RPC_ENDPOINTS[Math.floor(Math.random() * SOLANA_RPC_ENDPOINTS.length)];
    
    console.log(`Forwarding request to: ${endpoint.url}`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if needed
    if (endpoint.apiKey) {
      headers['x-api-key'] = endpoint.apiKey;
    }
    
    // Forward the request to the RPC endpoint
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });
    
    // Get the response data
    const data = await response.json();
    
    // Log any RPC errors for debugging
    if (data.error) {
      console.error('RPC Error:', data.error);
    }
    
    // Return the response
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy request to RPC endpoint' });
  }
});

// Serve static files (if needed)
app.use(express.static(join(__dirname, 'build')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Solana RPC proxy available at http://localhost:${PORT}/solana-rpc`);
}); 
