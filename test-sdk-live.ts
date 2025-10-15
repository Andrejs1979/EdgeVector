/**
 * Live SDK Test against running dev server
 */

import { EdgeVectorClient } from './sdk/dist/index.js';

async function testSDK() {
  console.log('🧪 Testing EdgeVector SDK against live server\n');

  const client = new EdgeVectorClient({
    baseUrl: 'http://localhost:8787',
  });

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const health = await client.health();
    console.log('✅ Health check passed:', {
      status: health.status,
      version: health.version,
      environment: health.environment,
    });

    // Test 2: Authentication
    console.log('\n2️⃣ Testing authentication...');
    try {
      const email = `test-${Date.now()}@example.com`;
      const authResult = await client.auth.register({
        email,
        password: 'secure_password_123',
        name: 'Test User',
      });
      console.log('✅ Authentication passed:', {
        userId: authResult.user.id,
        email: authResult.user.email,
        hasToken: !!authResult.token,
      });
    } catch (error: any) {
      if (error.message?.includes('Rate limit')) {
        console.log('⚠️  Rate limit hit - skipping auth test');
      } else {
        throw error;
      }
    }

    // Test 3: Raw query
    console.log('\n3️⃣ Testing raw GraphQL query...');
    const queryResult = await client.rawQuery(`
      query {
        health {
          status
          version
          environment
        }
      }
    `);
    console.log('✅ Raw query passed:', queryResult);

    console.log('\n🎉 All SDK tests passed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ SDK test failed:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

testSDK();
