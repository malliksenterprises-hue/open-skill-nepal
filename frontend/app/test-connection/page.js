'use client';
import { useState, useEffect } from 'react';
import api from '@/utils/api';

export default function TestConnection() {
  const [status, setStatus] = useState('testing');
  const [data, setData] = useState(null);
  const [endpoints, setEndpoints] = useState({});

  useEffect(() => {
    testAllEndpoints();
  }, []);

  const testEndpoint = async (name, endpoint) => {
    try {
      const response = await api.get(endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const testAllEndpoints = async () => {
    const endpointsToTest = {
      'Health': '/api/health',
      'Schools': '/api/schools',
      'Courses': '/api/courses',
      'Teachers': '/api/teachers'
    };

    const results = {};
    for (const [name, endpoint] of Object.entries(endpointsToTest)) {
      results[name] = await testEndpoint(name, endpoint);
    }

    setEndpoints(results);
    
    // Overall status based on health check
    if (results['Health'].success) {
      setStatus('connected');
      setData(results['Health'].data);
    } else {
      setStatus('failed');
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Frontend-Backend Connection Test</h1>
      
      <div style={{ 
        padding: '1rem', 
        backgroundColor: status === 'connected' ? '#d4edda' : status === 'failed' ? '#f8d7da' : '#fff3cd',
        border: '1px solid',
        borderColor: status === 'connected' ? '#c3e6cb' : status === 'failed' ? '#f5c6cb' : '#ffeaa7',
        borderRadius: '4px',
        marginBottom: '2rem'
      }}>
        <h3>Overall Status: <span style={{ 
          color: status === 'connected' ? '#155724' : status === 'failed' ? '#721c24' : '#856404'
        }}>{status.toUpperCase()}</span></h3>
        
        {data && (
          <div>
            <p><strong>Backend Response:</strong></p>
            <pre style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <h3>Endpoint Tests:</h3>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {Object.entries(endpoints).map(([name, result]) => (
          <div key={name} style={{
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: result.success ? '#f8fff9' : '#fff8f8'
          }}>
            <strong>{name}:</strong> 
            <span style={{ color: result.success ? 'green' : 'red', marginLeft: '1rem' }}>
              {result.success ? '✅ CONNECTED' : '❌ FAILED'}
            </span>
            {!result.success && (
              <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                Error: {result.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
