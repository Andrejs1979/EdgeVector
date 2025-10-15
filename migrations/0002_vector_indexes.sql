-- Vector-specific indexes and metadata

-- Vector collections metadata
CREATE TABLE IF NOT EXISTS vector_collections (
    id TEXT PRIMARY KEY,
    collection_name TEXT NOT NULL UNIQUE,
    dimensions INTEGER NOT NULL,
    distance_metric TEXT NOT NULL, -- 'cosine', 'euclidean', 'dot_product'
    index_type TEXT DEFAULT 'flat', -- 'flat', 'hnsw', 'ivf'
    index_params JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector index metadata (for ANN indexes stored in Durable Objects)
CREATE TABLE IF NOT EXISTS vector_indexes (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    index_type TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    durable_object_id TEXT, -- ID of the DO storing this index
    document_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'building', -- 'building', 'ready', 'updating'
    FOREIGN KEY (collection_id) REFERENCES vector_collections(id)
);

CREATE INDEX idx_vector_indexes_collection ON vector_indexes(collection_id);
CREATE INDEX idx_vector_indexes_status ON vector_indexes(status);
