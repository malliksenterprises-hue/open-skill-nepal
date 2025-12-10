import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper
} from '@mui/material';
import {
  Devices,
  Warning,
  Info,
  Logout,
  Refresh,
  Computer,
  Smartphone,
  TabletMac
} from '@mui/icons-material';
import deviceValidationService from '@/services/DeviceValidationService';

const DeviceLimitWarning = ({ 
  open, 
  onClose, 
  validationResult,
  onRefresh,
  onLogoutOtherDevices
}) => {
  const [activeDevices, setActiveDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && validationResult) {
      fetchActiveDevices();
    }
  }, [open, validationResult]);

  const fetchActiveDevices = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/devices/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Failed to fetch active devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'mobile':
        return <Smartphone />;
      case 'tablet':
        return <TabletMac />;
      case 'desktop':
      default:
        return <Computer />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleLogoutDevice = async (deviceId) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await fetchActiveDevices();
        if (typeof onLogoutOtherDevices === 'function') {
          onLogoutOtherDevices();
        }
      }
    } catch (error) {
      console.error('Failed to logout device:', error);
    }
  };

  if (!validationResult) return null;

  const { limit, current, role } = validationResult;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Warning color="warning" />
        <Typography variant="h6">Device Limit Exceeded</Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            You have reached your device limit. As a {role}, you can only use {limit} device(s) at a time.
            Currently active: {current} device(s).
          </Alert>
          
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              To continue:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Log out from other devices below" 
                  secondary="This will end your session on that device"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Info fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Contact your administrator" 
                  secondary="Request a device limit increase if needed"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Refresh fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Refresh this page" 
                  secondary="After logging out from other devices"
                />
              </ListItem>
            </List>
          </Paper>
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Devices />
          Active Devices
        </Typography>
        
        {isLoading ? (
          <Typography>Loading active devices...</Typography>
        ) : activeDevices.length === 0 ? (
          <Typography color="textSecondary">No active devices found</Typography>
        ) : (
          <List>
            {activeDevices.map((device, index) => (
              <React.Fragment key={device._id || index}>
                <ListItem
                  secondaryAction={
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleLogoutDevice(device._id)}
                      disabled={device.isCurrentDevice}
                    >
                      {device.isCurrentDevice ? 'Current' : 'Logout'}
                    </Button>
                  }
                >
                  <ListItemIcon>
                    {getDeviceIcon(device.platform)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body1">
                        {device.browser?.name || 'Unknown Browser'} on {device.os?.name || 'Unknown OS'}
                        {device.isCurrentDevice && (
                          <Typography 
                            component="span" 
                            variant="caption" 
                            color="primary"
                            sx={{ ml: 1 }}
                          >
                            (Current Device)
                          </Typography>
                        )}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block">
                          Last active: {formatDate(device.lastSessionAt)}
                        </Typography>
                        <Typography variant="caption" display="block">
                          IP: {device.ipAddress || 'Unknown'} | Platform: {device.platform || 'Unknown'}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {index < activeDevices.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="body2" color="textSecondary">
            <Info fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
            Device limits help protect your account security and ensure fair resource usage.
            Each device counts toward your limit when actively used for live classes or meetings.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={onRefresh} 
          variant="contained" 
          color="primary"
          startIcon={<Refresh />}
        >
          Refresh & Try Again
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeviceLimitWarning;
