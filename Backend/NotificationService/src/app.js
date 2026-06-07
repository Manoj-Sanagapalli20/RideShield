const express = require('express');
const cors = require('cors');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ service: 'NotificationService', status: 'Running' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
