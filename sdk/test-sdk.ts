/**
 * Quick SDK Test
 *
 * Tests the SDK against a running EdgeVector server
 */

import { EdgeVectorClient } from './dist/index.js';

async function main() {
  console.log('=== Testing EdgeVector SDK ===\n');

  const client = new EdgeVectorClient({
    baseUrl: 'http://localhost:8787',
  });

  try {
    // 1. Health check
    console.log('1. Health check...');
    const health = await client.health();
    console.log(`✓ Status: ${health.status}`);
    console.log(`✓ Service: ${health.service} v${health.version}`);
    console.log(`✓ Environment: ${health.environment}\n`);

    // 2. Register user
    console.log('2. Registering user...');
    const { token, user } = await client.auth.register({
      email: `test-${Date.now()}@example.com`,
      password: 'test_password_123',
      name: 'SDK Test User',
    });
    console.log(`✓ Registered: ${user.email}`);
    console.log(`✓ Token: ${token.substring(0, 30)}...\n`);

    // 3. Get current user
    console.log('3. Getting current user...');
    const me = await client.auth.me();
    console.log(`✓ Logged in as: ${me.email} (${me.name})\n`);

    // 4. Create collection
    console.log('4. Creating collection...');
    const collectionName = `test_${Date.now()}`;
    await client.collections.create(collectionName);
    console.log(`✓ Created collection: ${collectionName}\n`);

    // 5. Insert documents
    console.log('5. Inserting documents...');
    const insertResult = await client.documents.insertMany(collectionName, [
      { name: 'Alice', age: 30, role: 'developer' },
      { name: 'Bob', age: 25, role: 'designer' },
      { name: 'Charlie', age: 35, role: 'manager' },
    ]);
    console.log(`✓ Inserted ${insertResult.insertedCount} documents\n`);

    // 6. Find documents
    console.log('6. Finding documents...');
    const findResult = await client.documents.find(collectionName, {
      age: { $gte: 30 },
    });
    console.log(`✓ Found ${findResult.count} documents:`);
    findResult.documents.forEach((doc) => {
      console.log(`  - ${doc.name} (${doc.age}, ${doc.role})`);
    });
    console.log();

    // 7. Update document
    console.log('7. Updating document...');
    const updateResult = await client.documents.updateOne(
      collectionName,
      { name: 'Alice' },
      { $set: { age: 31 }, $push: { skills: 'TypeScript' } }
    );
    console.log(`✓ Updated ${updateResult.modifiedCount} document\n`);

    // 8. Delete document
    console.log('8. Deleting document...');
    const deleteResult = await client.documents.deleteOne(collectionName, {
      name: 'Charlie',
    });
    console.log(`✓ Deleted ${deleteResult.deletedCount} document\n`);

    // 9. Count documents
    console.log('9. Counting documents...');
    const count = await client.documents.count(collectionName);
    console.log(`✓ Total documents: ${count}\n`);

    // 10. Cleanup
    console.log('10. Cleaning up...');
    await client.collections.delete(collectionName);
    console.log(`✓ Deleted collection\n`);

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
