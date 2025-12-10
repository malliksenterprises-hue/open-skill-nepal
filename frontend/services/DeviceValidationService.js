import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { v4 as uuidv4 } from 'uuid';

class DeviceValidationService {
  constructor() {
    this.DEVICE_ID_KEY = 'edu_device_id';
    this.DEVICE_FINGERPRINT_KEY = 'edu_device_fingerprint';
    this.LAST_VALIDATION_KEY = 'edu_last_device_validation';
    this.VALIDATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Generate or retrieve device fingerprint
   * @returns {Promise<string>} Device fingerprint
   */
  async getDeviceFingerprint() {
    try {
      // Check if we already have a fingerprint in localStorage
      const storedFingerprint = localStorage.getItem(this.DEVICE_FINGERPRINT_KEY);
      
      if (storedFingerprint) {
        return storedFingerprint;
      }

      // Generate new fingerprint using FingerprintJS
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      
      const fingerprint = result.visitorId;
      
      // Store in localStorage
      localStorage.setItem(this.DEVICE_FINGERPRINT_KEY, fingerprint);
      
      return fingerprint;
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      
      // Fallback to UUID if fingerprint generation fails
      const fallbackId = uuidv4();
      localStorage.setItem(this.DEVICE_FINGERPRINT_KEY, fallbackId);
      
      return fallbackId;
    }
  }

  /**
   * Get or create device ID
   * @returns {string} Device ID
   */
  getDeviceId() {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Get device information
   * @returns {Object} Device info
   */
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const screenResolution = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cookiesEnabled = navigator.cookieEnabled;
    const doNotTrack = navigator.doNotTrack;
    const hardwareConcurrency = navigator.hardwareConcurrency || 'unknown';
    const deviceMemory = navigator.deviceMemory || 'unknown';
    
    return {
      userAgent,
      platform,
      language,
      screenResolution,
      timezone,
      cookiesEnabled,
      doNotTrack,
      hardwareConcurrency,
      deviceMemory,
      referrer: document.referrer || 'direct',
      url: window.location.href
    };
  }

  /**
   * Get browser information
   * @returns {Object} Browser info
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    
    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browser = 'Chrome';
      const match = ua.match(/Chrome\/(\d+\.\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
      const match = ua.match(/Firefox\/(\d+\.\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
      const match = ua.match(/Version\/(\d+\.\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('Edg')) {
      browser = 'Edge';
      const match = ua.match(/Edg\/(\d+\.\d+)/);
      version = match ? match[1] : 'Unknown';
    }
    
    return {
      name: browser,
      version: version,
      userAgent: ua
    };
  }

  /**
   * Get OS information
   * @returns {Object} OS info
   */
  getOSInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    let version = 'Unknown';
    
    // Detect OS
    if (ua.includes('Windows')) {
      os = 'Windows';
      if (ua.includes('Windows NT 10.0')) version = '10';
      else if (ua.includes('Windows NT 6.3')) version = '8.1';
      else if (ua.includes('Windows NT 6.2')) version = '8';
      else if (ua.includes('Windows NT 6.1')) version = '7';
    } else if (ua.includes('Mac')) {
      os = 'MacOS';
      const match = ua.match(/Mac OS X (\d+[._]\d+)/);
      version = match ? match[1].replace('_', '.') : 'Unknown';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    } else if (ua.includes('Android')) {
      os = 'Android';
      const match = ua.match(/Android (\d+\.\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
      os = 'iOS';
      const match = ua.match(/OS (\d+[._]\d+)/);
      version = match ? match[1].replace('_', '.') : 'Unknown';
    }
    
    return {
      name: os,
      version: version
    };
  }

  /**
   * Determine platform type
   * @returns {string} Platform type
   */
  getPlatformType() {
    const ua = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
      return 'mobile';
    } else if (/tablet/.test(ua)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Validate device before joining session
   * @param {string} userId - User ID
   * @param {string} schoolId - School ID
   * @param {string} sessionType - Session type
   * @returns {Promise<Object>} Validation result
   */
  async validateDevice(userId, schoolId, sessionType = 'live-class') {
    try {
      const deviceFingerprint = await this.getDeviceFingerprint();
      const deviceId = this.getDeviceId();
      const deviceInfo = this.getDeviceInfo();
      const browserInfo = this.getBrowserInfo();
      const osInfo = this.getOSInfo();
      const platform = this.getPlatformType();
      
      // Check if validation is cached
      const lastValidation = localStorage.getItem(this.LAST_VALIDATION_KEY);
      if (lastValidation) {
        const validationData = JSON.parse(lastValidation);
        const now = Date.now();
        
        // Use cached validation if it's still valid
        if (now - validationData.timestamp < this.VALIDATION_EXPIRY) {
          return {
            valid: true,
            deviceFingerprint,
            deviceId,
            cached: true,
            ...validationData.data
          };
        }
      }
      
      // Make API call to validate device
      const response = await fetch('/api/devices/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          schoolId,
          sessionType,
          deviceFingerprint,
          deviceId,
          deviceInfo: {
            ...deviceInfo,
            browser: browserInfo,
            os: osInfo,
            platform
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }
      
      const validationResult = await response.json();
      
      // Cache the validation result
      localStorage.setItem(this.LAST_VALIDATION_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: validationResult
      }));
      
      return {
        valid: validationResult.valid,
        deviceFingerprint,
        deviceId,
        cached: false,
        ...validationResult
      };
      
    } catch (error) {
      console.error('Device validation error:', error);
      
      // Fail open - allow access in case of validation errors
      return {
        valid: true,
        deviceFingerprint: await this.getDeviceFingerprint(),
        deviceId: this.getDeviceId(),
        error: true,
        message: 'Validation service unavailable. Access granted with limited features.',
        allowAccess: true
      };
    }
  }

  /**
   * Check if device limit warning should be shown
   * @param {Object} validationResult - Validation result from backend
   * @returns {boolean}
   */
  shouldShowDeviceWarning(validationResult) {
    return validationResult && 
           validationResult.valid === false && 
           validationResult.reason === 'device-limit-exceeded';
  }

  /**
   * Get device limit warning message
   * @param {Object} validationResult - Validation result
   * @returns {string} Warning message
   */
  getDeviceWarningMessage(validationResult) {
    if (!this.shouldShowDeviceWarning(validationResult)) {
      return '';
    }
    
    const { limit, current } = validationResult;
    return `Device limit exceeded. You can only use ${limit} devices. Currently active: ${current}. Please log out from other devices or contact your administrator.`;
  }

  /**
   * Clear device data (for logout)
   */
  clearDeviceData() {
    localStorage.removeItem(this.DEVICE_ID_KEY);
    localStorage.removeItem(this.DEVICE_FINGERPRINT_KEY);
    localStorage.removeItem(this.LAST_VALIDATION_KEY);
  }

  /**
   * Get all device data for debugging
   * @returns {Object} Device data
   */
  getAllDeviceData() {
    return {
      deviceId: this.getDeviceId(),
      deviceFingerprint: localStorage.getItem(this.DEVICE_FINGERPRINT_KEY),
      deviceInfo: this.getDeviceInfo(),
      browserInfo: this.getBrowserInfo(),
      osInfo: this.getOSInfo(),
      platform: this.getPlatformType(),
      lastValidation: localStorage.getItem(this.LAST_VALIDATION_KEY)
    };
  }
}

// Create singleton instance
const deviceValidationService = new DeviceValidationService();

export default deviceValidationService;
