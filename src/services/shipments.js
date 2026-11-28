const { pool } = require('../db');
const { withTransaction } = require('../db/transaction');
const { generateTrackingNumber } = require('../utils/generateTrackingNumber');

const MAX_SHORT_TEXT = 120;
const MAX_PHONE_LENGTH = 32;
const MAX_ADDRESS_LENGTH = 500;
const MAX_COLLISION_RETRIES = 3;

const SHIPMENT_STATUSES = [
  'pending',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'failed',
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function createHttpError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) {
    err.code = code;
  }
  return err;
}

function parsePositiveInt(value, fieldName) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      throw createHttpError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
    }
    return value;
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw createHttpError(`${fieldName} must be a positive integer`, 400, 'VALIDATION_ERROR');
}

function parseFilterDate(rawValue, paramName, isEndOfDay = false) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw createHttpError(`${paramName} must be a valid date`, 400, 'VALIDATION_ERROR');
  }

  const trimmed = rawValue.trim();
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const normalized = dateOnlyMatch
    ? `${trimmed}${isEndOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`
    : trimmed;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(`${paramName} must be a valid ISO date`, 400, 'VALIDATION_ERROR');
  }

  return parsed.toISOString();
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

async function getShipmentById(rawId) {
  const shipmentId = parsePositiveInt(rawId, 'id');

  const shipmentResult = await pool.query(
    `SELECT
      id,
      tracking_number,
      sender_name,
      receiver_name,
      receiver_phone,
      pickup_address,
      delivery_address,
      weight_kg,
      status,
      created_by,
      created_at,
      updated_at
    FROM shipments
    WHERE id = $1`,
    [shipmentId]
  );

  if (shipmentResult.rows.length === 0) {
    throw createHttpError('Shipment not found', 404, 'NOT_FOUND');
  }

  const eventsResult = await pool.query(
    `SELECT
      id,
      shipment_id,
      from_status,
      to_status,
      changed_by,
      note,
      created_at
    FROM shipment_events
    WHERE shipment_id = $1
    ORDER BY created_at ASC, id ASC`,
    [shipmentId]
  );

  return {
    ...shipmentResult.rows[0],
    events: eventsResult.rows,
  };
}

async function listShipments(query = {}) {
  const conditions = [];
  const params = [];

  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !SHIPMENT_STATUSES.includes(query.status.trim())) {
      throw createHttpError(
        `Invalid status. Allowed values: ${SHIPMENT_STATUSES.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    params.push(query.status.trim());
    conditions.push(`status = $${params.length}`);
  }

  let fromIso = null;
  let toIso = null;

  if (query.from !== undefined) {
    fromIso = parseFilterDate(query.from, 'from', false);
    params.push(fromIso);
    conditions.push(`created_at >= $${params.length}`);
  }

  if (query.to !== undefined) {
    toIso = parseFilterDate(query.to, 'to', true);
    params.push(toIso);
    conditions.push(`created_at <= $${params.length}`);
  }

  if (fromIso && toIso && new Date(fromIso) > new Date(toIso)) {
    throw createHttpError('from date must not be after to date', 400, 'VALIDATION_ERROR');
  }

  const page = query.page === undefined ? DEFAULT_PAGE : parsePositiveInt(query.page, 'page');
  const rawLimit =
    query.limit === undefined ? DEFAULT_LIMIT : parsePositiveInt(query.limit, 'limit');
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const offset = (page - 1) * limit;

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
    FROM shipments
    ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  const listParams = [...params, limit, offset];
  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;

  const itemsResult = await pool.query(
    `SELECT
      id,
      tracking_number,
      sender_name,
      receiver_name,
      receiver_phone,
      pickup_address,
      delivery_address,
      weight_kg,
      status,
      created_by,
      created_at,
      updated_at
    FROM shipments
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    listParams
  );

  return {
    items: itemsResult.rows,
    total,
    page,
    limit,
  };
}

module.exports = {
  SHIPMENT_STATUSES,
  createShipment,
  getShipmentById,
  listShipments,
  validateShipmentInput,
};