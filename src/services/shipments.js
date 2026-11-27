const { withTransaction } = require('../db/transaction');
const { generateTrackingNumber } = require('../utils/generateTrackingNumber');

const MAX_STRING_LENGTH = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_ADDRESS_LENGTH = 500;
const MAX_TRACKING_RETRIES = 3;

function createValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function validateCreateShipmentInput(payload = {}) {
  const stringFields = [
    ['sender_name', MAX_STRING_LENGTH],
    ['receiver_name', MAX_STRING_LENGTH],
    ['receiver_phone', MAX_PHONE_LENGTH],
    ['pickup_address', MAX_ADDRESS_LENGTH],
    ['delivery_address', MAX_ADDRESS_LENGTH],
  ];

  const cleaned = {};

  for (const [field, maxLen] of stringFields) {
    const raw = payload[field];
    if (typeof raw !== 'string') {
      throw createValidationError(`${field} must be a string`);
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      throw createValidationError(`${field} cannot be empty`);
    }
    if (trimmed.length > maxLen) {
      throw createValidationError(`${field} must not exceed ${maxLen} characters`);
    }
    cleaned[field] = trimmed;
  }

  const weight = Number(payload.weight_kg);
  if (
    payload.weight_kg === null ||
    payload.weight_kg === undefined ||
    payload.weight_kg === '' ||
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    throw createValidationError('weight_kg must be a positive number');
  }

  cleaned.weight_kg = weight;
  return cleaned;
}

async function createShipment(payload, actorUserId) {
  const input = validateCreateShipmentInput(payload);

  for (let attempt = 1; attempt <= MAX_TRACKING_RETRIES; attempt += 1) {
    const trackingNumber = generateTrackingNumber();

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
    } catch (error) {
      if (error.code === '23505' && attempt < MAX_TRACKING_RETRIES) {
        continue;
      }
      throw error;
    }
  }
}

module.exports = {
  createShipment,
  validateCreateShipmentInput,
};