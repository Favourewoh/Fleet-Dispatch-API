const express = require('express');
const { login, me } = require('../controllers/authController');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/authenticateToken');

const router = express.Router();

router.post('/login', loginRateLimiter, login);

router.get('/me',authenticateToken, me);

module.exports = router;