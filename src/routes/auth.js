const express = require('express');
const { login, me, register } = require('../controllers/authController');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/authenticateToken');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.get('/me',authenticateToken, me);
router.post('/register', authenticateToken, authorizeRoles('admin'), register);

module.exports = router;