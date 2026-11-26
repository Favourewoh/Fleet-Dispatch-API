const crypto = require('crypto');

const TRACKING_PREFIX = 'FSC';

function generateTrackingNumber(prefix = TRACKING_PREFIX) {
  // 6 random bytes = 12 uppercase hex characters (48 bits of entropy)
  const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `${prefix}-${randomPart}`;
}

module.exports = { generateTrackingNumber };