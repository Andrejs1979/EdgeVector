-- Vector Storage Enhancement
-- Adds dedicated vectors table for storing embeddings with metadata

-- Vectors table for storing individual vector embeddings
CREATE TABLE IF NOT EXISTS vectors (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    vector BLOB NOT NULL,
    dimensions INTEGER NOT NULL,
    normalized BOOLEAN DEFAULT FALSE,
    model_name TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(_id) ON DELETE CASCADE
);

-- Indexes for efficient vector retrieval
CREATE INDEX idx_vectors_document ON vectors(document_id);
CREATE INDEX idx_vectors_collection ON vectors(collection);
CREATE INDEX idx_vectors_model ON vectors(model_name);
CREATE INDEX idx_vectors_dimensions ON vectors(dimensions);

-- Composite index for collection + model queries
CREATE INDEX idx_vectors_collection_model ON vectors(collection, model_name);

-- Vector search cache (for frequently accessed vectors)
CREATE TABLE IF NOT EXISTS vector_cache (
    cache_key TEXT PRIMARY KEY,
    vector_ids JSON NOT NULL, -- Array of vector IDs
    query_hash TEXT NOT NULL,
    results JSON NOT NULL,
    similarity_metric TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_vector_cache_hash ON vector_cache(query_hash);
CREATE INDEX idx_vector_cache_expires ON vector_cache(expires_at);

-- Vector search statistics
CREATE TABLE IF NOT EXISTS vector_search_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    query_vector_dims INTEGER NOT NULL,
    similarity_metric TEXT NOT NULL,
    k_neighbors INTEGER NOT NULL,
    search_time_ms REAL NOT NULL,
    vectors_scanned INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vector_stats_collection ON vector_search_stats(collection);
CREATE INDEX idx_vector_stats_timestamp ON vector_search_stats(timestamp DESC);

-- Embedding generation queue (for async embedding generation)
CREATE TABLE IF NOT EXISTS embedding_queue (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    text_content TEXT NOT NULL,
    model_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX idx_embedding_queue_created ON embedding_queue(created_at);
