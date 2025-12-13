/**
 * ClassJoin Component
 * Handles Class Login authentication and device validation for live class access
 * Used by schools for classroom/smart board access
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Stack,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Classroom as ClassroomIcon,
  Devices as DevicesIcon,
  Security as SecurityIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import DeviceValidationService, { DeviceValidationResult } from '../../services/deviceValidation.service';
import { authenticateClassLogin } from '../../services/auth.service';
import { ClassLoginAuthResponse } from '../../types/auth.types';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  borderRadius: theme.spacing(2),
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
}));

const DeviceLimitChip = styled(Chip)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  fontWeight: 'bold',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2),
  textAlign: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(10px)',
}));

interface ClassJoinProps {
  classId?: string;
  redirectTo?: string;
}

const ClassJoin: React.FC<ClassJoinProps> = ({ classId, redirectTo = '/live-class/room' }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get classId from URL if not provided as prop
  const urlClassId = searchParams?.get('classId') || classId;
  
  // State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deviceCheck, setDeviceCheck] = useState<{
    canJoin: boolean;
    isLimitReached: boolean;
    hasExistingSession: boolean;
    maxDevices: number;
    currentDevices: number;
  } | null>(null);
  
  const [validationResult, setValidationResult] = useState<DeviceValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  // Check device limit when loginId changes (debounced)
  useEffect(() => {
    const checkDeviceLimit = async () => {
      if (loginId.length >= 6 && urlClassId) {
        try {
          setIsValidating(true);
          const result = await DeviceValidationService.checkDeviceLimit(urlClassId);
          setDeviceCheck(result);
          
          if (result.isLimitReached && !result.hasExistingSession) {
            setError(`Device limit reached (${result.currentDevices}/${result.maxDevices} devices).`);
          } else {
            setError(null);
          }
        } catch (err: any) {
          console.warn('Device limit check failed:', err);
          setDeviceCheck(null);
        } finally {
          setIsValidating(false);
        }
      }
    };
    
    const timeoutId = setTimeout(checkDeviceLimit, 500);
    return () => clearTimeout(timeoutId);
  }, [loginId, urlClassId]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginId || !password) {
      setError('Please enter both Login ID and Password');
      return;
    }
    
    if (!urlClassId) {
      setError('Class ID is required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Authenticate Class Login
      const authResponse: ClassLoginAuthResponse = await authenticateClassLogin(
        loginId.toUpperCase(),
        password,
        urlClassId
      );
      
      if (authResponse.success && authResponse.data?.token) {
        setSuccess('Authentication successful! Validating device...');
        
        // Validate device
        const validation = await DeviceValidationService.validateDevice();
        setValidationResult(validation);
        
        if (validation.isValid) {
          setSuccess('Device validated successfully! Redirecting to live class...');
          
          // Start periodic validation
          DeviceValidationService.startPeriodicValidation();
          
          // Redirect to live class room
          setTimeout(() => {
            router.push(`${redirectTo}?classId=${urlClassId}&session=${authResponse.data?.device?.sessionId}`);
          }, 1500);
        } else {
          setError(`Device validation failed: ${validation.message}`);
          setLoading(false);
        }
      } else {
        setError(authResponse.message || 'Authentication failed');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Class Login failed:', err);
      setError(err.message || 'An error occurred during authentication');
      setLoading(false);
    }
  };
  
  // Handle validation failed event
  useEffect(() => {
    const handleValidationFailed = (result: DeviceValidationResult) => {
      setError(`Device validation failed: ${result.message}`);
      // Optionally redirect to login or show re-authentication modal
    };
    
    DeviceValidationService.onValidationFailed(handleValidationFailed);
    
    return () => {
      // Cleanup event listener
      window.removeEventListener('device-validation-failed', handleValidationFailed as EventListener);
    };
  }, []);
  
  // Render device limit information
  const renderDeviceLimitInfo = () => {
    if (!deviceCheck) return null;
    
    const { canJoin, isLimitReached, hasExistingSession, maxDevices, currentDevices } = deviceCheck;
    const remaining = maxDevices - currentDevices;
    
    return (
      <Alert
        severity={canJoin ? 'info' : 'warning'}
        icon={canJoin ? <CheckCircleIcon /> : <ErrorIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" fontWeight="medium">
          Device Limit: {currentDevices}/{maxDevices} devices
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {isLimitReached ? (
            hasExistingSession ? (
              'You have an existing session on this device.'
            ) : (
              'Device limit reached. No more devices can join.'
            )
          ) : (
            `${remaining} device${remaining === 1 ? '' : 's'} can still join.`
          )}
        </Typography>
        {hasExistingSession && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Your existing session will be reused.
          </Typography>
        )}
      </Alert>
    );
  };
  
  // Render validation status
  const renderValidationStatus = () => {
    if (!validationResult) return null;
    
    return (
      <Alert
        severity={validationResult.isValid ? 'success' : 'error'}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2">
          {validationResult.message}
          {validationResult.expiresAt && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              Session expires: {validationResult.expiresAt.toLocaleTimeString()}
            </Typography>
          )}
        </Typography>
      </Alert>
    );
  };
  
  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit(e);
    }
  };
  
  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <ClassroomIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Classroom Access
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Enter your Class Login credentials to access the live classroom
          </Typography>
          
          {urlClassId && (
            <Chip
              label={`Class ID: ${urlClassId}`}
              color="primary"
              variant="outlined"
              sx={{ mb: 2 }}
            />
          )}
        </Box>
        
        <Divider sx={{ mb: 4 }}>
          <Chip label="Authentication" size="small" />
        </Divider>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={7}>
            <form onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              {success && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  {success}
                </Alert>
              )}
              
              {renderDeviceLimitInfo()}
              {renderValidationStatus()}
              
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="Class Login ID"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  required
                  autoFocus
                  placeholder="e.g., SCHOOL001"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SecurityIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Enter the Class Login ID provided by your school"
                />
                
                <TextField
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SecurityIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={loading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Enter the password for this Class Login"
                />
                
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || isValidating || (deviceCheck?.isLimitReached && !deviceCheck?.hasExistingSession)}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={24} sx={{ mr: 2 }} />
                      Authenticating...
                    </>
                  ) : isValidating ? (
                    <>
                      <CircularProgress size={24} sx={{ mr: 2 }} />
                      Checking Device Limit...
                    </>
                  ) : (
                    'Join Classroom'
                  )}
                </Button>
                
                {deviceCheck?.isLimitReached && !deviceCheck?.hasExistingSession && (
                  <Alert severity="warning" variant="outlined">
                    <Typography variant="body2">
                      Device limit reached. Please contact your School Admin to reset devices or use an existing device.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </form>
            
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                This login is for classroom/smart board access only.
                Students should use Google OAuth to access recorded content.
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <FeatureCard>
                <DevicesIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Device Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Each Class Login has a device limit. School Admins can manage and reset devices.
                </Typography>
                {deviceCheck && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Current: {deviceCheck.currentDevices} / {deviceCheck.maxDevices}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Status: {deviceCheck.canJoin ? 'Can Join' : 'Limit Reached'}
                    </Typography>
                  </Box>
                )}
              </FeatureCard>
              
              <FeatureCard>
                <ClassroomIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Live Classroom Features
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Real-time video streaming
                  • Screen sharing capability
                  • Classroom microphone control
                  • Interactive whiteboard
                  • Teacher-student chat
                </Typography>
              </FeatureCard>
              
              <FeatureCard>
                <SecurityIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Secure Access
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Device fingerprinting
                  • Real-time validation
                  • Session management
                  • Automatic logout
                  • Activity logging
                </Typography>
              </FeatureCard>
            </Stack>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 4 }}>
          <Chip label="Important Notes" size="small" />
        </Divider>
        
        <Alert severity="info" variant="outlined">
          <Typography variant="body2">
            <strong>Note for Students:</strong> This is NOT for student access. Students should use Google OAuth to login and access recorded classes only.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Note for Teachers:</strong> Use your teacher credentials to start live classes. Classroom devices use Class Login for access.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Device Limit:</strong> Each Class Login supports a limited number of simultaneous devices. Contact your School Admin for device management.
          </Typography>
        </Alert>
      </StyledPaper>
    </Container>
  );
};

export default ClassJoin;
