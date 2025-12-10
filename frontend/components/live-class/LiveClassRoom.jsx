import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Button,
  Paper
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import io from 'socket.io-client';
import deviceValidationService from '@/services/DeviceValidationService';
import DeviceLimitWarning from './DeviceLimitWarning';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
import WebSocketService from '@/utils/api';

// Error Fallback Component
const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <Box sx={{ p: 3, textAlign: 'center' }}>
    <Alert severity="error" sx={{ mb: 2 }}>
      Something went wrong with the live class
    </Alert>
    <Typography color="textSecondary" sx={{ mb: 2 }}>
      {error.message}
    </Typography>
    <Button onClick={resetErrorBoundary} variant="contained">
      Try Again
    </Button>
  </Box>
);

const LiveClassRoom = () => {
  const { sessionId } = useParams();
  const router = useRouter();
  
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [showDeviceWarning, setShowDeviceWarning] = useState(false);
  const [deviceValidationResult, setDeviceValidationResult] = useState(null);
  const [mediaError, setMediaError] = useState(null);

  // Exponential backoff for reconnection
  const getReconnectDelay = (attempts) => {
    return Math.min(1000 * Math.pow(2, attempts), 30000);
  };

  // Initialize WebSocket connection with device validation
  const initializeWebSocket = useCallback(async () => {
    try {
      // First, validate device
      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      
      const validationResult = await deviceValidationService.validateDevice(
        userData.id,
        userData.schoolId,
        'live-class'
      );

      setDeviceValidationResult(validationResult);

      if (deviceValidationService.shouldShowDeviceWarning(validationResult)) {
        setShowDeviceWarning(true);
        setIsLoading(false);
        return;
      }

      // Get device fingerprint
      const deviceFingerprint = await deviceValidationService.getDeviceFingerprint();
      
      // Initialize WebSocket connection
      const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080', {
        auth: {
          token,
          deviceFingerprint
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: getReconnectDelay(reconnectAttempts)
      });

      // Connection event handlers
      socketInstance.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        
        // Join session
        socketInstance.emit('join-session', { sessionId });
      });

      socketInstance.on('connected', (data) => {
        console.log('WebSocket authenticated:', data);
      });

      socketInstance.on('device-limit-exceeded', (data) => {
        console.warn('Device limit exceeded:', data);
        setDeviceValidationResult({
          valid: false,
          reason: 'device-limit-exceeded',
          ...data
        });
        setShowDeviceWarning(true);
        socketInstance.disconnect();
      });

      socketInstance.on('session-info', (sessionData) => {
        setSession(sessionData);
        setIsLoading(false);
      });

      socketInstance.on('error', (errorData) => {
        console.error('WebSocket error:', errorData);
        setError(errorData.message || 'WebSocket error occurred');
      });

      socketInstance.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect' || reason === 'transport close') {
          // Server initiated disconnect, attempt to reconnect
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            initializeWebSocket();
          }, getReconnectDelay(reconnectAttempts + 1));
        }
      });

      socketInstance.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
      });

      socketInstance.on('reconnect_error', (error) => {
        console.error('WebSocket reconnection error:', error);
      });

      socketInstance.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed');
        setError('Failed to reconnect to live session. Please refresh the page.');
      });

      setSocket(socketInstance);

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setError('Failed to connect to live session');
      setIsLoading(false);
    }
  }, [sessionId, reconnectAttempts]);

  // Handle media stream errors
  const handleMediaError = useCallback((error) => {
    console.error('Media stream error:', error);
    setMediaError(error.message || 'Failed to access camera/microphone');
    
    // Log error for analytics
    fetch('/api/analytics/media-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        error: error.toString(),
        timestamp: new Date().toISOString()
      })
    }).catch(console.error);
  }, [sessionId]);

  // Initialize on component mount
  useEffect(() => {
    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [initializeWebSocket]);

  // Handle device warning close
  const handleDeviceWarningClose = () => {
    setShowDeviceWarning(false);
    router.push('/dashboard');
  };

  // Handle refresh after device logout
  const handleRefresh = () => {
    setShowDeviceWarning(false);
    setIsLoading(true);
    initializeWebSocket();
  };

  // Handle logout other devices
  const handleLogoutOtherDevices = () => {
    // This will trigger a refresh which will revalidate
    handleRefresh();
  };

  // Handle media retry
  const handleMediaRetry = async () => {
    setMediaError(null);
    try {
      // Request media permissions again
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      // Close the stream immediately since we just wanted to test permissions
      stream.getTracks().forEach(track => track.stop());
      
      // Reinitialize WebSocket connection
      initializeWebSocket();
    } catch (error) {
      handleMediaError(error);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Connecting to live session...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => window.location.reload()} variant="contained">
          Refresh Page
        </Button>
      </Container>
    );
  }

  if (mediaError) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Media Access Required
          </Alert>
          <Typography paragraph>
            {mediaError}
          </Typography>
          <Typography paragraph color="textSecondary">
            Please check your camera and microphone permissions and try again.
          </Typography>
          <Button onClick={handleMediaRetry} variant="contained" sx={{ mr: 2 }}>
            Retry Media Access
          </Button>
          <Button onClick={() => router.push('/dashboard')} variant="outlined">
            Return to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Connection Status Bar */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 1, 
            bgcolor: isConnected ? 'success.light' : 'error.light',
            color: 'white',
            textAlign: 'center'
          }}
        >
          <Typography variant="caption">
            {isConnected ? '● Connected' : '○ Disconnected'}
            {reconnectAttempts > 0 && ` (Reconnecting ${reconnectAttempts}/5)`}
          </Typography>
        </Paper>

        {/* Main Content */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Video Area - Placeholder for now */}
          <Box sx={{ flex: 3, bgcolor: 'grey.900', p: 2 }}>
            <Typography variant="h5" color="white" gutterBottom>
              {session?.title || 'Live Session'}
            </Typography>
            <Box sx={{ 
              bgcolor: 'grey.800', 
              height: '70%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              borderRadius: 1
            }}>
              <Typography color="grey.500">
                Video stream will appear here
              </Typography>
            </Box>
          </Box>

          {/* Side Panels */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 300 }}>
            <ParticipantsPanel 
              sessionId={sessionId}
              socket={socket}
              isTeacher={session?.teacherId === JSON.parse(localStorage.getItem('user') || '{}').id}
            />
            <ChatPanel sessionId={sessionId} socket={socket} />
          </Box>
        </Box>

        {/* Device Limit Warning Modal */}
        <DeviceLimitWarning
          open={showDeviceWarning}
          onClose={handleDeviceWarningClose}
          validationResult={deviceValidationResult}
          onRefresh={handleRefresh}
          onLogoutOtherDevices={handleLogoutOtherDevices}
        />

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />
      </Box>
    </ErrorBoundary>
  );
};

export default LiveClassRoom;
