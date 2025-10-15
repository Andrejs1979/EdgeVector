/**
 * Basic CRUD Operations Example
 *
 * Demonstrates how to perform create, read, update, and delete operations
 * on documents using the EdgeVector SDK
 */

import { EdgeVectorClient } from '../src';

async function main() {
  // Initialize client
  const client = new EdgeVectorClient({
    baseUrl: 'http://localhost:8787',
  });

  console.log('=== EdgeVector SDK - Basic CRUD Example ===\n');

  try {
    // 1. Register and login
    console.log('1. Registering user...');
    const { token, user } = await client.auth.register({
      email: `user-${Date.now()}@example.com`,
      password: 'secure_password_123',
      name: 'John Doe',
    });
    console.log(`✓ Registered user: ${user.email}`);
    console.log(`✓ Token: ${token.substring(0, 20)}...\n`);

    // 2. Create a collection
    console.log('2. Creating collection...');
    const collectionName = `users_${Date.now()}`;
    await client.collections.create(collectionName);
    console.log(`✓ Collection created: ${collectionName}\n`);

    // 3. Insert a single document
    console.log('3. Inserting a document...');
    const insertResult = await client.documents.insertOne(collectionName, {
      name: 'Alice Smith',
      email: 'alice@example.com',
      age: 28,
      role: 'developer',
      skills: ['JavaScript', 'TypeScript', 'React'],
      active: true,
    });
    console.log(`✓ Document inserted with ID: ${insertResult._id}\n`);

    // 4. Insert multiple documents
    console.log('4. Inserting multiple documents...');
    const insertManyResult = await client.documents.insertMany(collectionName, [
      {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        age: 35,
        role: 'designer',
        skills: ['Figma', 'Photoshop', 'Illustrator'],
        active: true,
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        age: 42,
        role: 'manager',
        skills: ['Leadership', 'Strategy', 'Communication'],
        active: false,
      },
      {
        name: 'Diana Prince',
        email: 'diana@example.com',
        age: 31,
        role: 'developer',
        skills: ['Python', 'Go', 'Rust'],
        active: true,
      },
    ]);
    console.log(`✓ Inserted ${insertManyResult.insertedCount} documents\n`);

    // 5. Find all documents
    console.log('5. Finding all documents...');
    const allDocs = await client.documents.find(collectionName);
    console.log(`✓ Found ${allDocs.count} documents:`);
    allDocs.documents.forEach((doc) => {
      console.log(`  - ${doc.name} (${doc.role})`);
    });
    console.log();

    // 6. Find documents with filter
    console.log('6. Finding active developers...');
    const activeDevelopers = await client.documents.find(collectionName, {
      role: 'developer',
      active: true,
    });
    console.log(`✓ Found ${activeDevelopers.count} active developers:`);
    activeDevelopers.documents.forEach((doc) => {
      console.log(`  - ${doc.name} (${doc.age} years old)`);
    });
    console.log();

    // 7. Find documents with complex query
    console.log('7. Finding users over 30 with specific skills...');
    const experienced = await client.documents.find(collectionName, {
      $and: [
        { age: { $gte: 30 } },
        { active: true },
        { skills: { $size: 3 } },
      ],
    });
    console.log(`✓ Found ${experienced.count} experienced users\n`);

    // 8. Find one document
    console.log('8. Finding user by email...');
    const alice = await client.documents.findOne(collectionName, {
      email: 'alice@example.com',
    });
    if (alice) {
      console.log(`✓ Found: ${alice.name}, Skills: ${alice.skills.join(', ')}\n`);
    }

    // 9. Update a document
    console.log('9. Updating Alice\'s age...');
    const updateResult = await client.documents.updateOne(
      collectionName,
      { email: 'alice@example.com' },
      {
        $set: { age: 29 },
        $push: { skills: 'Node.js' },
      }
    );
    console.log(`✓ Modified ${updateResult.modifiedCount} document\n`);

    // 10. Verify update
    console.log('10. Verifying update...');
    const updatedAlice = await client.documents.findOne(collectionName, {
      email: 'alice@example.com',
    });
    if (updatedAlice) {
      console.log(`✓ Alice's age is now ${updatedAlice.age}`);
      console.log(`✓ Alice's skills: ${updatedAlice.skills.join(', ')}\n`);
    }

    // 11. Update multiple documents
    console.log('11. Activating all users...');
    const updateManyResult = await client.documents.updateMany(
      collectionName,
      { active: false },
      { $set: { active: true } }
    );
    console.log(`✓ Activated ${updateManyResult.modifiedCount} users\n`);

    // 12. Count documents
    console.log('12. Counting active users...');
    const activeCount = await client.documents.count(collectionName, {
      active: true,
    });
    console.log(`✓ Total active users: ${activeCount}\n`);

    // 13. Delete a document
    console.log('13. Deleting Charlie...');
    const deleteResult = await client.documents.deleteOne(collectionName, {
      email: 'charlie@example.com',
    });
    console.log(`✓ Deleted ${deleteResult.deletedCount} document\n`);

    // 14. Delete multiple documents
    console.log('14. Deleting all users over 40...');
    const deleteManyResult = await client.documents.deleteMany(collectionName, {
      age: { $gt: 40 },
    });
    console.log(`✓ Deleted ${deleteManyResult.deletedCount} documents\n`);

    // 15. Final count
    console.log('15. Final document count...');
    const finalCount = await client.documents.count(collectionName);
    console.log(`✓ Remaining documents: ${finalCount}\n`);

    // 16. List all collections
    console.log('16. Listing all collections...');
    const collections = await client.collections.list();
    console.log(`✓ Total collections: ${collections.length}`);
    collections.forEach((col) => {
      console.log(`  - ${col.name}: ${col.documentCount} documents`);
    });
    console.log();

    // 17. Cleanup
    console.log('17. Cleaning up...');
    await client.collections.delete(collectionName);
    console.log(`✓ Deleted collection: ${collectionName}\n`);

    console.log('=== All CRUD operations completed successfully! ===');
  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
  }
}

// Run the example
main();
