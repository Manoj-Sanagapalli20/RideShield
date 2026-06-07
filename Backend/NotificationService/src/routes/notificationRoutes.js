const express = require('express');
const router = express.Router();
const { healthCheck } = require('../controllers/notificationController');

router.get('/health', healthCheck);

module.exports = router;
