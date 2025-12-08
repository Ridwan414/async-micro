const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_SERVICE_URL = process.env.BACKEND_SERVICE_URL || 'http://backend:8000';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product:8001';

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// Route to create a task (proxies to backend service)
app.post('/api/task', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_SERVICE_URL}/task`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Backend', res);
  }
});

// Product service routes
app.get('/api/products', async (req, res) => {
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${PRODUCT_SERVICE_URL}/products${queryString ? '?' + queryString : ''}`;
    const response = await axios.get(url);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/products/${req.params.id}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const response = await axios.post(`${PRODUCT_SERVICE_URL}/products`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const response = await axios.put(`${PRODUCT_SERVICE_URL}/products/${req.params.id}`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const response = await axios.delete(`${PRODUCT_SERVICE_URL}/products/${req.params.id}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

app.patch('/api/products/:id/stock', async (req, res) => {
  try {
    const response = await axios.patch(`${PRODUCT_SERVICE_URL}/products/${req.params.id}/stock`, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    handleServiceError(error, 'Product', res);
  }
});

// Helper function for error handling
function handleServiceError(error, serviceName, res) {
  console.error(`Error forwarding request to ${serviceName} service:`, error.message);
  
  if (error.response) {
    res.status(error.response.status).json({
      error: `${serviceName} service error`,
      details: error.response.data
    });
  } else if (error.request) {
    res.status(503).json({
      error: `${serviceName} service unavailable`,
      details: `Could not reach ${serviceName.toLowerCase()} service`
    });
  } else {
    res.status(500).json({
      error: 'Gateway error',
      details: error.message
    });
  }
}

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: [
      'GET /health',
      'POST /api/task',
      'GET /api/products',
      'GET /api/products/:id',
      'POST /api/products',
      'PUT /api/products/:id',
      'DELETE /api/products/:id',
      'PATCH /api/products/:id/stock'
    ]
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Backend service URL: ${BACKEND_SERVICE_URL}`);
  console.log(`Product service URL: ${PRODUCT_SERVICE_URL}`);
});

