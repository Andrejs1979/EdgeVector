-- Real-time subscriptions and streaming infrastructure

-- Subscription registry
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    subscription_type TEXT NOT NULL, -- 'query', 'document', 'vector', 'timeseries'
    collection TEXT,
    query JSON,
    filters JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_event_id TEXT,
    active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_subscriptions_client ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_collection ON subscriptions(collection);
CREATE INDEX idx_subscriptions_active ON subscriptions(active);

-- SSE connections
CREATE TABLE IF NOT EXISTS sse_connections (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    established_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_event_id TEXT,
    compression_enabled BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_sse_client ON sse_connections(client_id);
CREATE INDEX idx_sse_heartbeat ON sse_connections(last_heartbeat);

-- Change data capture log
CREATE TABLE IF NOT EXISTS cdc_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL, -- 'insert', 'update', 'delete'
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    before_data JSON,
    after_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_cdc_collection ON cdc_log(collection, timestamp DESC);
CREATE INDEX idx_cdc_published ON cdc_log(published);
CREATE INDEX idx_cdc_timestamp ON cdc_log(timestamp DESC);
