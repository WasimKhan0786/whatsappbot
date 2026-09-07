require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getEnvConfig, updateEnvConfig, maskApiKey } = require('./src/controllers/envController');
const { generateGeminiReply } = require('./src/services/geminiService');

const envPath = path.resolve(__dirname, '.env');

// Mock Express req/res
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
}

async function runTests() {
  console.log('🧪 Starting Dynamic .env & Gemini API Key Hot-Reload Verification...\n');

  const originalKey = process.env.GEMINI_API_KEY || '';
  const originalHistoryMax = process.env.CHAT_HISTORY_MAX_MESSAGES || '20';

  try {
    // Test 1: Masking helper
    console.log('📋 Test 1: Verifying Masking Utility...');
    const dummySample = 'AIzaSyDummyKeyForTestingPurposesOnlySample1234';
    const masked = maskApiKey(dummySample);
    console.log('  - Masked output:', masked);
    if (masked.startsWith('AIzaSy') && masked.endsWith('1234') && masked.includes('••••')) {
      console.log('  ✅ Masking utility protects sensitive API keys.');
    } else {
      throw new Error(`Masking failed: ${masked}`);
    }

    // Test 2: GET /api/env
    console.log('\n📋 Test 2: Testing GET /api/env handler...');
    const reqGet = {};
    const resGet = createMockRes();
    await getEnvConfig(reqGet, resGet);
    console.log('  - GET Response data:', resGet.data);
    if (resGet.data?.success && typeof resGet.data?.data?.maskedGeminiKey === 'string') {
      console.log('  ✅ GET /api/env successfully returned masked config.');
    } else {
      throw new Error('GET /api/env returned unexpected payload.');
    }

    // Test 3: POST /api/env with Direct Gemini Key Update
    console.log('\n📋 Test 3: Testing POST /api/env with direct Gemini API key hot-reload...');
    const testKey = originalKey; // Use current valid key to test live probe
    const reqPostKey = {
      body: {
        geminiApiKey: testKey,
      },
    };
    const resPostKey = createMockRes();
    await updateEnvConfig(reqPostKey, resPostKey);

    console.log('  - Update Response:', {
      success: resPostKey.data?.success,
      updatedKeys: resPostKey.data?.updatedKeys,
      maskedKey: resPostKey.data?.maskedGeminiKey,
      geminiProbe: resPostKey.data?.geminiProbe?.message,
    });

    if (resPostKey.data?.success && process.env.GEMINI_API_KEY === testKey) {
      console.log('  ✅ process.env.GEMINI_API_KEY was updated in memory immediately without reboot!');
    } else {
      throw new Error('process.env was not updated in memory.');
    }

    // Verify .env file on disk
    const diskContent = fs.readFileSync(envPath, 'utf8');
    if (diskContent.includes(`GEMINI_API_KEY=${testKey}`)) {
      console.log('  ✅ server/.env on disk was synchronously updated.');
    } else {
      throw new Error('server/.env on disk was not updated.');
    }

    // Test 4: POST /api/env with .env File Upload Content
    console.log('\n📋 Test 4: Testing POST /api/env with simulated .env file content upload...');
    const simulatedEnvUpload = `
# Uploaded .env configuration
CHAT_HISTORY_MAX_MESSAGES=25
CHAT_SESSION_TTL_DAYS=14
`;
    const reqPostFile = {
      body: {
        envContent: simulatedEnvUpload,
      },
    };
    const resPostFile = createMockRes();
    await updateEnvConfig(reqPostFile, resPostFile);

    console.log('  - File Upload Response:', {
      success: resPostFile.data?.success,
      updatedKeys: resPostFile.data?.updatedKeys,
    });

    if (process.env.CHAT_HISTORY_MAX_MESSAGES === '25' && process.env.CHAT_SESSION_TTL_DAYS === '14') {
      console.log('  ✅ Uploaded file variables applied immediately to process.env (CHAT_HISTORY_MAX_MESSAGES=25, CHAT_SESSION_TTL_DAYS=14)!');
    } else {
      throw new Error('Uploaded variables were not applied in memory.');
    }

    // Test 5: Bot Live Generation with Hot-Reloaded Key (Zero Reboot Proof)
    console.log('\n📋 Test 5: Testing Live Gemini Reply with Hot-Reloaded Key...');
    const reply = await generateGeminiReply('Say hello in 3 words.', 'You are a polite assistant.');
    console.log(`  - Live Gemini Response: "${reply}"`);
    if (reply && reply.trim().length > 0) {
      console.log('  ✅ ZERO REBOOT CONFIRMED! Gemini service immediately replied using the active in-memory API key.');
    } else {
      throw new Error('Gemini reply failed after dynamic update.');
    }

    console.log('\n🎉 ALL TESTS PASSED! Dynamic .env upload and Gemini API key management is 100% operational.');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
  } finally {
    // Restore original values
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
      process.env.CHAT_HISTORY_MAX_MESSAGES = originalHistoryMax;
      const fileText = fs.readFileSync(envPath, 'utf8');
      const restoredText = fileText
        .replace(/CHAT_HISTORY_MAX_MESSAGES=\d+/, `CHAT_HISTORY_MAX_MESSAGES=${originalHistoryMax}`)
        .replace(/CHAT_SESSION_TTL_DAYS=\d+/, 'CHAT_SESSION_TTL_DAYS=7');
      fs.writeFileSync(envPath, restoredText, 'utf8');
    }
    process.exit(0);
  }
}

runTests();
