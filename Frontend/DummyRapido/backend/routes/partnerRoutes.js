const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');

// Registration route
router.post('/register', partnerController.registerPartner);

// Login route (by phone)
router.post('/login', partnerController.loginPartner);

// Login route (by partnerId)
router.post('/login-partner-id', partnerController.loginWithPartnerId);

// Get profile route (by partnerId)
router.get('/profile/:partnerId', partnerController.getPartnerProfile);

// Save hourly activity route
router.post('/save-log', partnerController.saveDailyLog);

// Fetch hourly activity route
router.get('/daily-logs/:partnerId/:date', partnerController.getDailyLog);

module.exports = router;
