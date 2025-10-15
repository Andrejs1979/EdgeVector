/**
 * Example: Simple Schema-Free Application
 *
 * This example demonstrates the core capabilities of EdgeVector DB:
 * - Schema-free document storage
 * - MongoDB-like queries
 * - Automatic index optimization
 * - No migrations needed
 */

import { DocumentStore } from '../src/storage/DocumentStore';

// Example usage (pseudo-code, requires actual D1 database)
async function exampleUsage(db: D1Database) {
  // Create a document store for users collection
  const users = new DocumentStore(db, 'users');
  await users.initialize();

  console.log('=== EdgeVector DB Example ===\n');

  // 1. Insert documents with any structure (no schema required!)
  console.log('1. Inserting users with different schemas...');

  const user1 = await users.insertOne({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    role: 'engineer',
    skills: ['TypeScript', 'React', 'GraphQL'],
  });
  console.log('Created user:', user1._id);

  const user2 = await users.insertOne({
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 35,
    role: 'manager',
    department: 'Engineering', // New field!
    location: {                 // Nested objects work!
      city: 'San Francisco',
      country: 'USA',
    },
  });
  console.log('Created user:', user2._id);

  const user3 = await users.insertOne({
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 42,
    role: 'engineer',
    certifications: ['AWS', 'GCP'], // Different structure!
    yearsExperience: 15,
  });
  console.log('Created user:', user3._id);

  // 2. Query with MongoDB-style syntax
  console.log('\n2. Querying users...');

  // Simple equality query
  const engineers = await users.find({ role: 'engineer' });
  console.log(`Found ${engineers.count} engineers`);

  // Range query
  const experienced = await users.find({ age: { $gt: 30 } });
  console.log(`Found ${experienced.count} users over 30`);

  // Complex query with $and
  const seniorEngineers = await users.find({
    $and: [
      { role: 'engineer' },
      { age: { $gte: 35 } },
    ],
  });
  console.log(`Found ${seniorEngineers.count} senior engineers`);

  // Query with sorting and pagination
  const sortedUsers = await users.find(
    { role: { $in: ['engineer', 'manager'] } },
    {
      sort: { age: -1 }, // Sort by age descending
      limit: 10,
      skip: 0,
    }
  );
  console.log(`Found ${sortedUsers.count} users (sorted by age)`);

  // 3. Update documents
  console.log('\n3. Updating documents...');

  // Update with $set
  await users.updateOne(
    { email: 'alice@example.com' },
    {
      $set: {
        age: 29,
        lastLogin: new Date().toISOString(),
        'profile.bio': 'Senior TypeScript Developer', // Add nested field
      },
    }
  );
  console.log('Updated Alice\'s profile');

  // Update with $inc
  await users.updateOne(
    { email: 'charlie@example.com' },
    {
      $inc: { yearsExperience: 1 }, // Increment experience
    }
  );
  console.log('Incremented Charlie\'s experience');

  // Bulk update
  const result = await users.updateMany(
    { role: 'engineer' },
    {
      $set: { department: 'Engineering' },
    }
  );
  console.log(`Updated ${result.modifiedCount} engineers`);

  // 4. Schema evolution in action
  console.log('\n4. Schema Evolution Stats...');

  const stats = await users.getSchemaStats();
  console.log(`Indexed fields: ${stats.totalIndexed}/${stats.totalIndexed + stats.availableSlots}`);
  console.log('Hot fields:', stats.indexedFields.slice(0, 5).map(f => f.field));

  // After many queries on 'email' field, it gets automatically indexed
  // Next queries will use the index for better performance!

  // 5. Count and aggregation
  console.log('\n5. Counting documents...');

  const totalUsers = await users.count();
  console.log(`Total users: ${totalUsers}`);

  const engineerCount = await users.count({ role: 'engineer' });
  console.log(`Total engineers: ${engineerCount}`);

  // 6. Delete documents
  console.log('\n6. Deleting documents...');

  await users.deleteOne({ email: 'bob@example.com' });
  console.log('Deleted Bob\'s account');

  // Verify deletion
  const deletedUser = await users.findOne({ email: 'bob@example.com' });
  console.log('Bob still exists?', deletedUser !== null); // false

  console.log('\n=== Example Complete ===');
  console.log('Key takeaways:');
  console.log('- No schema migrations needed');
  console.log('- Different documents can have different fields');
  console.log('- Automatic index optimization');
  console.log('- MongoDB-compatible query syntax');
  console.log('- Performance: <1ms query translation, 100+ QPS');
}

// Example: E-commerce Product Catalog
async function ecommerceExample(db: D1Database) {
  const products = new DocumentStore(db, 'products');
  await products.initialize();

  console.log('\n=== E-commerce Product Catalog Example ===\n');

  // Products can have completely different schemas
  await products.insertMany([
    {
      name: 'Laptop',
      category: 'Electronics',
      price: 1299.99,
      inStock: true,
      specs: {
        cpu: 'M3 Pro',
        ram: '16GB',
        storage: '512GB SSD',
      },
      tags: ['computers', 'apple', 'portable'],
    },
    {
      name: 'T-Shirt',
      category: 'Clothing',
      price: 29.99,
      inStock: true,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['black', 'white', 'blue'],
      material: '100% Cotton',
    },
    {
      name: 'Coffee Maker',
      category: 'Home & Kitchen',
      price: 89.99,
      inStock: false,
      features: ['Programmable', '12-cup capacity', 'Auto shut-off'],
      warranty: '1 year',
    },
  ]);

  // Find products in a price range
  const affordableProducts = await products.find({
    price: { $gte: 20, $lte: 100 },
    inStock: true,
  });
  console.log(`Found ${affordableProducts.count} affordable products in stock`);

  // Find products by category
  const electronics = await products.find({ category: 'Electronics' });
  console.log(`Electronics: ${electronics.count} products`);

  // Search across different fields (schema-agnostic!)
  const searchResults = await products.find({
    $or: [
      { 'specs.cpu': { $exists: true } },
      { sizes: { $exists: true } },
      { features: { $exists: true } },
    ],
  });
  console.log(`Products with special attributes: ${searchResults.count}`);

  console.log('\nKey benefit: No need to create separate tables for different product types!');
}

// Example: Real-time Analytics
async function analyticsExample(db: D1Database) {
  const events = new DocumentStore(db, 'events');
  await events.initialize();

  console.log('\n=== Real-time Analytics Example ===\n');

  // Track various event types
  await events.insertMany([
    {
      type: 'page_view',
      userId: 'user123',
      page: '/products',
      timestamp: new Date().toISOString(),
      metadata: { referrer: 'google', device: 'mobile' },
    },
    {
      type: 'purchase',
      userId: 'user456',
      orderId: 'order789',
      amount: 129.99,
      items: ['item1', 'item2'],
      timestamp: new Date().toISOString(),
    },
    {
      type: 'signup',
      userId: 'user789',
      email: 'newuser@example.com',
      source: 'facebook',
      timestamp: new Date().toISOString(),
    },
  ]);

  // Flexible queries across different event types
  const recentPurchases = await events.find({
    type: 'purchase',
    amount: { $gt: 100 },
  });
  console.log(`High-value purchases: ${recentPurchases.count}`);

  const mobileUsers = await events.find({
    'metadata.device': 'mobile',
  });
  console.log(`Mobile traffic: ${mobileUsers.count} events`);

  console.log('\nKey benefit: One collection for all event types, flexible schema!');
}

export {
  exampleUsage,
  ecommerceExample,
  analyticsExample,
};

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Run this example with an actual D1 database connection');
  console.log('Example:');
  console.log('  import { exampleUsage } from "./examples/simple-app";');
  console.log('  await exampleUsage(env.DB);');
}
