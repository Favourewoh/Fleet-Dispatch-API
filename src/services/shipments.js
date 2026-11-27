const { withTransaction } = require('../db/transaction');
const { generateTrackingNumber } = require('../utils/generateTrackingNumber');

const MAX_SHORT_TEXT = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_ADDRESS_LENGTH = 500;
const MAX_COLLISION_RETRIES = 3;

function createHttpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) {
    err.code = code;
  }
  return err;
}

function validateShipmentInput(body = {}) {
  const textRules = [
    ['sender_name', MAX_SHORT_TEXT],
    ['receiver_name', MAX_SHORT_TEXT],
    ['receiver_phone', MAX_PHONE_LENGTH],
    ['pickup_address', MAX_ADDRESS_LENGTH],
    ['delivery_address', MAX_ADDRESS_LENGTH],
  ];

  const data = {};

  for (const [field, maxLength] of textRules) {
    const value = body[field];
    if (typeof value !== 'string') {
      throw createHttpError(`${field} must be a string`, 400, 'VALIDATION_ERROR');
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw createHttpError(`${field} must not be empty`, 400, 'VALIDATION_ERROR');
    }
    if (trimmed.length > maxLength) {
      throw createHttpError(
        `${field} must be at most ${maxLength} characters`,
        400,
        'VALIDATION_ERROR'
      );
    }
    data[field] = trimmed;
  }

  const weight = Number(body.weight_kg);
  if (
    body.weight_kg === null ||
    body.weight_kg === undefined ||
    body.weight_kg === '' ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    throw createHttpError('weight_kg must be a positive number', 400, 'VALIDATION_ERROR');
  }

  data.weight_kg = weight;
  return data;
}

function isTrackingNumberCollision(err) {
  if (!err || err.code !== '23505') {
    return false;
  }
  if (err.constraint) {
    return err.constraint.includes('tracking_number');
  }
  if (err.detail) {
    return String(err.detail).includes('tracking_number');
  }
  return true;
}

async function createShipment(
  body,
  actorUserId,
  trackingGenerator = generateTrackingNumber
) {
  if (!actorUserId) {
    throw createHttpError('Authenticated user is required', 401, 'UNAUTHORIZED');
  }

  const input = validateShipmentInput(body);

  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt += 1) {
    const trackingNumber = trackingGenerator();

    try {
      return await withTransaction(async (client) => {
        const shipmentResult = await client.query(
          `INSERT INTO shipments (
            tracking_number,
            sender_name,
            receiver_name,
            receiver_phone,
            pickup_address,
            delivery_address,
            weight_kg,
            status,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
          RETURNING *`,
          [
            trackingNumber,
            input.sender_name,
            input.receiver_name,
            input.receiver_phone,
            input.pickup_address,
            input.delivery_address,
            input.weight_kg,
            actorUserId,
          ]
        );

        const shipment = shipmentResult.rows[0];

        await client.query(
          `INSERT INTO shipment_events (
            shipment_id,
            from_status,
            to_status,
            changed_by,
            note
          ) VALUES ($1, NULL, 'pending', $2, $3)`,
          [shipment.id, actorUserId, 'Shipment created']
        );

        return shipment;
      });
    } catch (err) {
      if (isTrackingNumberCollision(err)) {
        if (attempt < MAX_COLLISION_RETRIES) {
          continue;
        }
        throw createHttpError(
          'Failed to generate a unique tracking number after multiple attempts',
          500,
          'TRACKING_NUMBER_COLLISION'
        );
      }
      throw err;
    }
  }
}

module.exports = {
  createShipment,
  validateShipmentInput,
};