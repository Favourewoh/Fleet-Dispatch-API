const express = require('express');
const {
  createShipmentHandler,
  getShipmentByIdHandler,
  listShipmentsHandler,
} = require('../controllers/shipments');
const {authenticateToken} = require('../middleware/authenticateToken');
const { authorizeRoles } = require('../middleware/authorizeRoles');

const router = express.Router();

router.post(
  '/create',
  authenticateToken,
  authorizeRoles('admin', 'dispatcher'),
  createShipmentHandler
);

router.get(
  '/',
  authenticateToken,
  authorizeRoles('admin', 'dispatcher'),
  listShipmentsHandler
);

router.get(
  '/:id',
  authenticateToken,
  authorizeRoles('admin', 'dispatcher'),
  getShipmentByIdHandler
);

module.exports = router;