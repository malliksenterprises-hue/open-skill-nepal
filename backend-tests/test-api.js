const axios = require('axios');

const BASE_URL = 'https://open-skill-nepal-669869115660.asia-south1.run.app';

async function testAPI() {
  console.log('🧪 Testing Open Skill Nepal Backend API...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check:', healthResponse.data);

    // Test 2: Public endpoints
    console.log('\n2. Testing public endpoints...');
    
    const schoolsResponse = await axios.get(`${BASE_URL}/api/schools`);
    console.log('✅ Schools endpoint:', schoolsResponse.data.length || 0, 'schools found');

    const coursesResponse = await axios.get(`${BASE_URL}/api/courses`);
    console.log('✅ Courses endpoint:', coursesResponse.data.length || 0, 'courses found');

    const teachersResponse = await axios.get(`${BASE_URL}/api/teachers`);
    console.log('✅ Teachers endpoint:', teachersResponse.data.length || 0, 'teachers found');

    console.log('\n🎉 All backend API tests completed successfully!');
    console.log('🌐 Backend is ready for frontend integration.');

  } catch (error) {
    console.error('❌ API Test failed:', error.response?.data || error.message);
  }
}

testAPI();
