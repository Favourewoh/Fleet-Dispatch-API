const express = require('express');
const { handleCreateShipment } = require('../controllers/shipments');
const {authorizeRoles} = require('../middleware/authorizeRoles');
const { authenticateToken } = require('../middleware/authenticateToken');

const router = express.Router();

router.post(
  '/',
  authenticateToken,
  authorizeRoles('admin','dispatcher'),
  handleCreateShipment
);

module.exports = router;