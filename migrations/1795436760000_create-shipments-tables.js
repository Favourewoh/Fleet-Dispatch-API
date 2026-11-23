exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE shipments (
      id SERIAL PRIMARY KEY,
      tracking_number VARCHAR(64) NOT NULL UNIQUE,
      sender_name VARCHAR(120) NOT NULL,
      receiver_name VARCHAR(120) NOT NULL,
      receiver_phone VARCHAR(32) NOT NULL,
      pickup_address TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      weight_kg NUMERIC(10, 3) NOT NULL CHECK (weight_kg > 0),
      status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'picked_up',
            'in_transit',
            'assigned',
            'failed',
            'delivered',
            'cancelled'
          )
        ),
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE shipment_events (
      id SERIAL PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE RESTRICT,
      from_status VARCHAR(32)
        CHECK (
          from_status IS NULL OR from_status IN (
            'pending',
            'picked_up',
            'in_transit',
            'assigned',
            'failed',
            'delivered',
            'cancelled'
          )
        ),
      to_status VARCHAR(32) NOT NULL
        CHECK (
          to_status IN (
            'pending',
            'picked_up',
            'in_transit',
            'assigned',
            'failed',
            'delivered',
            'cancelled'
          )
        ),
      changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_shipments_status ON shipments(status);
    CREATE INDEX idx_shipment_events_shipment_id ON shipment_events(shipment_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_shipment_events_shipment_id;
    DROP INDEX IF EXISTS idx_shipments_status;
    DROP TABLE IF EXISTS shipment_events;
    DROP TABLE IF EXISTS shipments;
  `);
};