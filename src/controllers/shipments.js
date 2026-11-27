const { createShipment } = require('../services/shipments');

async function handleCreateShipment(req, res, next) {
  try {
    const shipment = await createShipment(req.body, req.user.id);
    return res.status(201).json({ data: shipment });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  handleCreateShipment,
};