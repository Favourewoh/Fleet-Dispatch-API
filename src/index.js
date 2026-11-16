const express = require('express');
const pool = require('./db/index.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Health check route
app.get('/health', async (req, res) => {
  try {
        
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});