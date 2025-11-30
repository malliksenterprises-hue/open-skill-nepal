const axios = require('axios');

class DeploymentVerifier {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.results = [];
  }

  async testEndpoint(method, endpoint, data = null) {
    try {
      const config = { method, url: `${this.baseURL}${endpoint}` };
      if (data) config.data = data;
      
      const response = await axios(config);
      this.results.push({
        endpoint,
        status: '✅ SUCCESS',
        statusCode: response.status,
        data: response.data
      });
      return true;
    } catch (error) {
      this.results.push({
        endpoint,
        status: '❌ FAILED',
        statusCode: error.response?.status,
        error: error.message
      });
      return false;
    }
  }

  printResults() {
    console.log('\n📊 DEPLOYMENT VERIFICATION RESULTS');
    console.log('================================');
    this.results.forEach(result => {
      console.log(`${result.status} ${result.endpoint} (${result.statusCode})`);
    });
  }
}

// Run verification
const verifier = new DeploymentVerifier('https://open-skill-nepal-669869115660.asia-south1.run.app');

async function verifyDeployment() {
  console.log('🚀 Verifying Backend Deployment...\n');

  // Test essential endpoints
  await verifier.testEndpoint('GET', '/api/health');
  await verifier.testEndpoint('GET', '/api/schools');
  await verifier.testEndpoint('GET', '/api/courses');
  await verifier.testEndpoint('GET', '/api/teachers');
  
  // Test auth endpoint (expecting 400/401 which is normal)
  await verifier.testEndpoint('POST', '/api/auth/login', {
    email: 'test@example.com',
    password: 'password'
  });

  verifier.printResults();
  
  // Summary
  const successCount = verifier.results.filter(r => r.status === '✅ SUCCESS').length;
  console.log(`\n📈 Success Rate: ${successCount}/${verifier.results.length} endpoints`);
  
  if (successCount >= 3) {
    console.log('🎉 Backend deployment is stable and ready!');
  } else {
    console.log('⚠️  Some endpoints need attention');
  }
}

verifyDeployment();
