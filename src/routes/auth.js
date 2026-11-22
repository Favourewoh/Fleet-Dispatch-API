const express = require('express');
const { login } = require('../controllers/authController');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginRateLimiter, login);

module.exports = router;