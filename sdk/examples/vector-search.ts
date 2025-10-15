/**
 * Vector Search Example
 *
 * Demonstrates how to use vector search capabilities including
 * embedding generation, semantic search, and similarity comparison
 */

import { EdgeVectorClient } from '../src';

async function main() {
  // Initialize client
  const client = new EdgeVectorClient({
    baseUrl: 'http://localhost:8787',
  });

  console.log('=== EdgeVector SDK - Vector Search Example ===\n');

  try {
    // 1. Register and login
    console.log('1. Registering user...');
    const { token } = await client.auth.register({
      email: `user-${Date.now()}@example.com`,
      password: 'secure_password_123',
    });
    console.log(`✓ Authenticated\n`);

    // 2. Create collection
    console.log('2. Creating articles collection...');
    const collectionName = `articles_${Date.now()}`;
    await client.collections.create(collectionName);
    console.log(`✓ Collection created: ${collectionName}\n`);

    // 3. Insert documents with text content
    console.log('3. Inserting articles...');
    const articles = [
      {
        title: 'Introduction to Machine Learning',
        content:
          'Machine learning is a subset of artificial intelligence that enables computers to learn from data without explicit programming. It uses algorithms to identify patterns and make predictions.',
        category: 'AI',
      },
      {
        title: 'Deep Learning Fundamentals',
        content:
          'Deep learning is a specialized form of machine learning using neural networks with multiple layers. It excels at tasks like image recognition and natural language processing.',
        category: 'AI',
      },
      {
        title: 'Database Design Principles',
        content:
          'Good database design involves normalization, indexing strategies, and query optimization. Understanding relational schemas is crucial for building scalable applications.',
        category: 'Database',
      },
      {
        title: 'Edge Computing Revolution',
        content:
          'Edge computing brings computation closer to data sources, reducing latency and bandwidth usage. It enables real-time processing for IoT devices and distributed applications.',
        category: 'Infrastructure',
      },
      {
        title: 'Natural Language Processing',
        content:
          'NLP combines linguistics and machine learning to enable computers to understand human language. Applications include sentiment analysis, translation, and chatbots.',
        category: 'AI',
      },
    ];

    const insertResult = await client.documents.insertMany(
      collectionName,
      articles
    );
    console.log(`✓ Inserted ${insertResult.insertedCount} articles\n`);

    // 4. Generate embeddings for each article
    console.log('4. Generating embeddings...');
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const docId = insertResult.insertedIds[i];

      // Generate embedding from article content
      const embeddingResult = await client.vectors.generateEmbedding(
        article.content,
        {
          model: 'bge-base',
          normalize: true,
          useCache: true,
        }
      );

      // Add vector to document
      await client.vectors.add(
        collectionName,
        docId,
        embeddingResult.embedding,
        {
          title: article.title,
          category: article.category,
          dimensions: embeddingResult.dimensions,
        }
      );

      console.log(`  ✓ ${article.title} (${embeddingResult.dimensions}D)`);
    }
    console.log();

    // 5. Semantic search by text
    console.log('5. Searching for "artificial intelligence and neural networks"...');
    const searchResults = await client.vectors.searchByText(
      'artificial intelligence and neural networks',
      {
        collection: collectionName,
        limit: 3,
        metric: 'cosine',
        threshold: 0.5,
      }
    );

    console.log(`✓ Found ${searchResults.results.length} results:`);
    searchResults.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.vector.metadata.title}`);
      console.log(`     Score: ${result.score.toFixed(4)}`);
      console.log(`     Distance: ${result.distance.toFixed(4)}`);
      console.log(`     Category: ${result.vector.metadata.category}`);
    });
    console.log(`  Search time: ${searchResults.stats.searchTimeMs}ms`);
    console.log();

    // 6. Search for database-related content
    console.log('6. Searching for "database optimization and indexing"...');
    const dbSearch = await client.vectors.searchByText(
      'database optimization and indexing',
      {
        collection: collectionName,
        limit: 2,
        metric: 'cosine',
      }
    );

    console.log(`✓ Found ${dbSearch.results.length} results:`);
    dbSearch.results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.vector.metadata.title}`);
      console.log(`     Score: ${result.score.toFixed(4)}`);
    });
    console.log();

    // 7. Compare similarity between two texts
    console.log('7. Comparing similarity between topics...');
    const similarity1 = await client.vectors.compareSimilarity(
      'machine learning and neural networks',
      'deep learning and artificial intelligence',
      { metric: 'cosine' }
    );

    console.log(`  "machine learning" vs "deep learning":`);
    console.log(`  Similarity: ${similarity1.similarity.toFixed(4)}\n`);

    const similarity2 = await client.vectors.compareSimilarity(
      'database design',
      'edge computing infrastructure',
      { metric: 'cosine' }
    );

    console.log(`  "database design" vs "edge computing":`);
    console.log(`  Similarity: ${similarity2.similarity.toFixed(4)}\n`);

    // 8. Get vector statistics
    console.log('8. Getting vector statistics...');
    const stats = await client.vectors.getStats(collectionName);
    console.log(`  Total vectors: ${stats.totalVectors}`);
    console.log(`  Dimensions: ${stats.dimensions}`);
    console.log(`  Models: ${stats.models.join(', ')}\n`);

    // 9. Search with different metrics
    console.log('9. Comparing similarity metrics...');
    const query = 'AI and machine learning';

    const metrics = ['cosine', 'euclidean', 'dot'] as const;
    for (const metric of metrics) {
      const results = await client.vectors.searchByText(query, {
        collection: collectionName,
        limit: 1,
        metric,
      });

      if (results.results.length > 0) {
        const result = results.results[0];
        console.log(`  ${metric.toUpperCase()}:`);
        console.log(`    Best match: ${result.vector.metadata.title}`);
        console.log(`    Score: ${result.score.toFixed(4)}`);
        console.log(`    Distance: ${result.distance.toFixed(4)}`);
      }
    }
    console.log();

    // 10. Generate batch embeddings
    console.log('10. Generating batch embeddings...');
    const texts = [
      'Artificial intelligence applications',
      'Database optimization techniques',
      'Cloud computing platforms',
    ];

    const batchResults = await client.vectors.generateEmbeddingBatch(texts, {
      model: 'bge-base',
    });

    console.log(`✓ Generated ${batchResults.length} embeddings:`);
    batchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${texts[index]}`);
      console.log(`     Dimensions: ${result.dimensions}`);
      console.log(`     Cached: ${result.cached}`);
    });
    console.log();

    // 11. Filter by metadata
    console.log('11. Searching AI articles only...');
    const aiSearch = await client.vectors.searchByText(
      'machine learning algorithms',
      {
        collection: collectionName,
        limit: 5,
        metadata: { category: 'AI' },
      }
    );

    console.log(`✓ Found ${aiSearch.results.length} AI articles:`);
    aiSearch.results.forEach((result) => {
      console.log(`  - ${result.vector.metadata.title}`);
    });
    console.log();

    // 12. Get specific vector
    console.log('12. Getting vector for first document...');
    const firstDocId = insertResult.insertedIds[0];
    const vector = await client.vectors.get(collectionName, firstDocId);
    if (vector) {
      console.log(`✓ Vector details:`);
      console.log(`  Document ID: ${vector.documentId}`);
      console.log(`  Dimensions: ${vector.dimensions}`);
      console.log(`  Model: ${vector.modelName}`);
      console.log(`  Normalized: ${vector.normalized}`);
      console.log(`  Created: ${new Date(vector.createdAt).toLocaleString()}`);
    }
    console.log();

    // 13. Cleanup
    console.log('13. Cleaning up...');
    await client.vectors.deleteCollection(collectionName);
    await client.collections.delete(collectionName);
    console.log(`✓ Cleanup complete\n`);

    console.log('=== Vector search example completed successfully! ===');
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the example
main();
