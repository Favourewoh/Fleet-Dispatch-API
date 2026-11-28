const {
  createShipment,
  getShipmentById,
  listShipments,
} = require('../services/shipments');

async function createShipmentHandler(req, res, next) {
  try {
    const shipment = await createShipment(req.body, req.user.id);
    return res.status(201).json({ data: shipment });
  } catch (err) {
    return next(err);
  }
}

async function getShipmentByIdHandler(req, res, next) {
  try {
    const shipment = await getShipmentById(req.params.id);
    return res.status(200).json({ data: shipment });
  } catch (err) {
    return next(err);
  }
}

async function listShipmentsHandler(req, res, next) {
  try {
    const result = await listShipments(req.query);
    return res.status(200).json({
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createShipmentHandler,
  getShipmentByIdHandler,
  listShipmentsHandler,
};