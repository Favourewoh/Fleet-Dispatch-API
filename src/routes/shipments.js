const express = require('express');
const { createShipmentHandler } = require('../controllers/shipments');
const {authenticateToken} = require('../middleware/authenticateToken');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

router.post(
  '/create',
  authenticateToken,
  authorizeRoles('admin', 'dispatcher'),
  createShipmentHandler
);

module.exports = router;