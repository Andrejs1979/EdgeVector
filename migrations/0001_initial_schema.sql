-- EdgeVector DB Initial Schema
-- Schema-free document storage with dynamic indexing

-- Collection registry
CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    config JSON,
    document_count INTEGER DEFAULT 0,
    total_size_bytes INTEGER DEFAULT 0
);

CREATE INDEX idx_collections_name ON collections(collection_name);

-- Universal document storage table
CREATE TABLE IF NOT EXISTS documents (
    -- Core metadata fields
    _id TEXT PRIMARY KEY,
    _collection TEXT NOT NULL,
    _version INTEGER DEFAULT 1,
    _created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _deleted BOOLEAN DEFAULT FALSE,

    -- Full document as JSON
    _data JSON NOT NULL,

    -- Dynamically managed indexed fields (up to 20 indexed columns)
    _idx_field_1 TEXT,
    _idx_field_2 TEXT,
    _idx_field_3 TEXT,
    _idx_field_4 TEXT,
    _idx_field_5 TEXT,
    _idx_field_6 REAL,
    _idx_field_7 REAL,
    _idx_field_8 REAL,
    _idx_field_9 INTEGER,
    _idx_field_10 INTEGER,
    _idx_field_11 INTEGER,
    _idx_field_12 TEXT,
    _idx_field_13 TEXT,
    _idx_field_14 REAL,
    _idx_field_15 INTEGER,
    _idx_field_16 TEXT,
    _idx_field_17 REAL,
    _idx_field_18 INTEGER,
    _idx_field_19 TEXT,
    _idx_field_20 TEXT,

    -- Vector storage
    _vector BLOB,
    _vector_dims INTEGER,

    -- Full-text search
    _search_text TEXT,

    -- Partitioning hints
    _partition_key TEXT,
    _shard_key TEXT
);

-- Core indexes
CREATE INDEX idx_documents_collection ON documents(_collection) WHERE _deleted = FALSE;
CREATE INDEX idx_documents_created ON documents(_created_at);
CREATE INDEX idx_documents_updated ON documents(_updated_at);
CREATE INDEX idx_documents_deleted ON documents(_deleted);

-- Index registry - tracks which fields are indexed in which columns
CREATE TABLE IF NOT EXISTS index_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    field_path TEXT NOT NULL,
    index_column TEXT NOT NULL,
    data_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection, field_path)
);

CREATE INDEX idx_registry_collection ON index_registry(collection);
CREATE INDEX idx_registry_column ON index_registry(index_column);

-- Query pattern statistics
CREATE TABLE IF NOT EXISTS query_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    field_path TEXT NOT NULL,
    query_count INTEGER DEFAULT 0,
    last_queried TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avg_result_count REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patterns_collection ON query_patterns(collection);
CREATE INDEX idx_patterns_count ON query_patterns(query_count DESC);

-- Collection views (virtual collections)
CREATE TABLE IF NOT EXISTS collection_views (
    id TEXT PRIMARY KEY,
    view_name TEXT NOT NULL UNIQUE,
    base_collection TEXT NOT NULL,
    pipeline JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Validation rules (optional schema validation)
CREATE TABLE IF NOT EXISTS validation_rules (
    collection TEXT PRIMARY KEY,
    rules JSON NOT NULL,
    strict_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shard metadata (for multi-D1 sharding)
CREATE TABLE IF NOT EXISTS shard_metadata (
    shard_id TEXT PRIMARY KEY,
    shard_type TEXT NOT NULL, -- 'tenant', 'range', 'geo', 'time'
    shard_key TEXT,
    key_range_start TEXT,
    key_range_end TEXT,
    database_id TEXT NOT NULL,
    database_name TEXT NOT NULL,
    size_bytes INTEGER DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'readonly', 'migrating', 'archived'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shard_type ON shard_metadata(shard_type);
CREATE INDEX idx_shard_status ON shard_metadata(status);

-- Time series specific tables

-- Time series metrics registry
CREATE TABLE IF NOT EXISTS timeseries_metrics (
    metric_name TEXT PRIMARY KEY,
    data_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram', 'summary'
    unit TEXT,
    description TEXT,
    retention_days INTEGER DEFAULT 7,
    compression_type TEXT DEFAULT 'gorilla', -- 'gorilla', 'zstd', 'none'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time series data (hot tier)
CREATE TABLE IF NOT EXISTS timeseries_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL,
    timestamp INTEGER NOT NULL, -- Unix timestamp (nanosecond precision)
    value REAL NOT NULL,
    tags JSON, -- Metadata tags as JSON
    fields JSON, -- Additional fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeseries_metric ON timeseries_data(metric, timestamp DESC);
CREATE INDEX idx_timeseries_timestamp ON timeseries_data(timestamp DESC);

-- Downsampling rules
CREATE TABLE IF NOT EXISTS downsampling_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric TEXT NOT NULL,
    interval TEXT NOT NULL, -- '1m', '5m', '1h', '1d'
    retention TEXT NOT NULL, -- '24h', '7d', '30d', '1y'
    aggregations JSON NOT NULL, -- ['avg', 'max', 'min', 'p95', 'p99']
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric, interval)
);

-- Continuous queries
CREATE TABLE IF NOT EXISTS continuous_queries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    query TEXT NOT NULL,
    interval TEXT NOT NULL,
    retention TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
