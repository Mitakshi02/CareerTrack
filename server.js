const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/opportunities', require('./routes/opportunities'));

// Fallback to SPA Frontend for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your web browser`);
  console.log(`======================================================\n`);
});

// Handle graceful shutdown for database connections
const gracefulShutdown = async () => {
  console.log('\nShutting down server gracefully...');
  server.close(async () => {
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('Mongoose database connection disconnected.');
    } catch (err) {
      console.error('Error closing Mongoose connection:', err.message);
    }
    
    // Stop local in-memory mongo server if initialized
    if (global.__MONGOD__) {
      console.log('Stopping in-memory MongoDB fallback server...');
      try {
        await global.__MONGOD__.stop();
        console.log('In-memory MongoDB stopped.');
      } catch (err) {
        console.error('Error stopping in-memory MongoDB server:', err.message);
      }
    }
    
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
