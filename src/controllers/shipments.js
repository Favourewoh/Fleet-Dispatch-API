const { createShipment } = require('../services/shipments');

async function createShipmentHandler(req, res, next) {
  try {
    const shipment = await createShipment(req.body, req.user.id);
    return res.status(201).json({ data: shipment });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createShipmentHandler,
};