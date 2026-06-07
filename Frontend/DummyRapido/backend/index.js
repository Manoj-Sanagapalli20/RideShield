require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const partnerRoutes = require('./routes/partnerRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Default Route
app.get('/', (req, res) => {
  res.send('Rapido Partner Backend API is running...');
});

// Partner Routes
app.use('/api/partners', partnerRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/dummyrapido")
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('⚠️ MongoDB connection error (Mock mode active):', err.message);
    // process.exit(1); 
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Rapido Backend Server running on port ${PORT}`);
});
