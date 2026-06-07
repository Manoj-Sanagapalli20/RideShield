const healthCheck = (req, res) => {
  console.log('Health check requested by', req.ip);
  res.status(200).json({
    status: 'success',
    message: 'Notification Service is running',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  healthCheck,
};
