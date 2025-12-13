/**
 * Device Validation Service
 * Handles device validation and limit checking for Class Login
 * Real-time validation for live class access
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { DeviceInfo, DeviceValidationResult, DeviceSession, ClassLoginInfo } from '../types/device.types';
import { getAuthToken, isClassLoginUser } from './auth.service';

class DeviceValidationService {
  private api: AxiosInstance;
  private static instance: DeviceValidationService;
  private sessionId: string | null = null;
  private validationInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.openskillnepal.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load session ID from localStorage
    if (typeof window !== 'undefined') {
      this.sessionId = localStorage.getItem('device_session_id');
    }
  }

  public static getInstance(): DeviceValidationService {
    if (!DeviceValidationService.instance) {
      DeviceValidationService.instance = new DeviceValidationService();
    }
    return DeviceValidationService.instance;
  }

  /**
   * Get device fingerprint (simplified version)
   * In production, use a proper fingerprinting library
   */
  private getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Determine device type
    let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
    if (/Mobile|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'tablet';
      } else {
        deviceType = 'mobile';
      }
    } else {
      deviceType = 'desktop';
    }

    // Determine browser
    let browser = 'unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'edge';
    }

    // Determine OS
    let os = 'unknown';
    if (userAgent.includes('Windows')) {
      os = 'windows';
    } else if (userAgent.includes('Mac OS')) {
      os = 'macos';
    } else if (userAgent.includes('Linux')) {
      os = 'linux';
    } else if (userAgent.includes('Android')) {
      os = 'android';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'ios';
    }

    return {
      userAgent,
      platform,
      language,
      timezone,
      deviceType,
      browser,
      os,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    };
  }

  /**
   * Check device limit before joining a live class
   * Used by Class Login users before authentication
   */
  public async checkDeviceLimit(classLoginId: string): Promise<{
    canJoin: boolean;
    isLimitReached: boolean;
    hasExistingSession: boolean;
    maxDevices: number;
    currentDevices: number;
  }> {
    try {
      const deviceInfo = this.getDeviceInfo();
      
      const response: AxiosResponse = await this.api.post(
        `/devices/check-limit/${classLoginId}`,
        { deviceInfo }
      );

      if (response.data.success) {
        const { classLogin, deviceCheck } = response.data.data;
        return {
          canJoin: deviceCheck.canJoin,
          isLimitReached: deviceCheck.isLimitReached,
          hasExistingSession: deviceCheck.hasExistingSession,
          maxDevices: classLogin.maxDevices,
          currentDevices: classLogin.currentDevices,
        };
      }

      throw new Error(response.data.message || 'Failed to check device limit');
    } catch (error: any) {
      console.error('Device limit check failed:', error);
      throw new Error(
        error.response?.data?.message ||
        error.message ||
        'Unable to check device limit. Please try again.'
      );
    }
  }

  /**
   * Validate device for live class access (real-time validation)
   * Must be called after Class Login authentication
   */
  public async validateDevice(): Promise<DeviceValidationResult> {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Only Class Login users need device validation
      if (!isClassLoginUser()) {
        return {
          isValid: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          message: 'Device validation not required for this user type',
        };
      }

      const response: AxiosResponse = await this.api.post(
        '/devices/validate',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const { validation, device, classLogin } = response.data.data;
        
        // Save session ID for future validations
        if (device?.id) {
          this.sessionId = device.id;
          if (typeof window !== 'undefined') {
            localStorage.setItem('device_session_id', device.id);
          }
        }

        return {
          isValid: validation.isValid,
          expiresAt: new Date(validation.expiresAt),
          deviceId: device?.id,
          classLoginId: classLogin?.id,
          maxDevices: classLogin?.maxDevices,
          message: 'Device validated successfully',
        };
      }

      throw new Error(response.data.message || 'Device validation failed');
    } catch (error: any) {
      console.error('Device validation failed:', error);
      
      // Handle specific error codes
      const errorCode = error.response?.data?.code;
      let message = error.response?.data?.message || error.message;

      switch (errorCode) {
        case 'DEVICE_SESSION_INVALID':
          message = 'Your device session is invalid. Please log in again.';
          break;
        case 'SESSION_EXPIRED':
          message = 'Your session has expired. Please log in again.';
          break;
        case 'CLASS_LOGIN_DISABLED':
          message = 'This Class Login has been disabled.';
          break;
        case 'CLASS_LOGIN_EXPIRED':
          message = 'This Class Login has expired.';
          break;
        case 'DEVICE_LIMIT_REACHED':
          message = 'Device limit reached for this Class Login.';
          break;
      }

      return {
        isValid: false,
        expiresAt: new Date(),
        message,
        errorCode,
      };
    }
  }

  /**
   * Start periodic device validation for live class sessions
   * Calls validateDevice every 5 minutes to keep session alive
   */
  public startPeriodicValidation(intervalMinutes: number = 5): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    this.validationInterval = setInterval(async () => {
      try {
        if (isClassLoginUser()) {
          const result = await this.validateDevice();
          if (!result.isValid) {
            // Stop validation if device is invalid
            this.stopPeriodicValidation();
            
            // Emit event for UI to handle
            this.emitValidationFailedEvent(result);
          }
        }
      } catch (error) {
        console.warn('Periodic device validation failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop periodic device validation
   */
  public stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  /**
   * Clear device session (on logout or when switching users)
   */
  public clearDeviceSession(): void {
    this.sessionId = null;
    this.stopPeriodicValidation();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('device_session_id');
    }
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Emit validation failed event
   */
  private emitValidationFailedEvent(result: DeviceValidationResult): void {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('device-validation-failed', {
        detail: result,
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Register validation failed callback
   */
  public onValidationFailed(callback: (result: DeviceValidationResult) => void): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('device-validation-failed', ((event: CustomEvent) => {
        callback(event.detail);
      }) as EventListener);
    }
  }

  /**
   * Get device limit warning message
   */
  public getDeviceLimitWarning(current: number, max: number): string {
    const remaining = max - current;
    
    if (remaining <= 0) {
      return `Device limit reached (${max}/${max} devices). No more devices can join.`;
    }
    
    if (remaining === 1) {
      return `Only 1 more device can join (${current}/${max} devices used).`;
    }
    
    if (remaining <= 3) {
      return `Only ${remaining} more devices can join (${current}/${max} devices used).`;
    }
    
    return `${remaining} devices can still join (${current}/${max} devices used).`;
  }

  /**
   * Check if device validation is required for current user
   */
  public isValidationRequired(): boolean {
    return isClassLoginUser();
  }

  /**
   * Simulate device validation for testing/demo
   */
  public async simulateValidation(isValid: boolean = true): Promise<DeviceValidationResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          isValid,
          expiresAt: new Date(Date.now() + (isValid ? 24 * 60 * 60 * 1000 : 0)),
          message: isValid ? 'Device validated successfully (simulated)' : 'Device validation failed (simulated)',
        });
      }, 1000);
    });
  }
}

export default DeviceValidationService.getInstance();

// Export types for use in other components
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  screenResolution: string;
  colorDepth: number;
  pixelRatio: number;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  hardwareConcurrency: number | string;
}

export interface DeviceValidationResult {
  isValid: boolean;
  expiresAt: Date;
  deviceId?: string;
  classLoginId?: string;
  maxDevices?: number;
  message: string;
  errorCode?: string;
}

export interface DeviceSession {
  id: string;
  classLoginId: string;
  lastActive: Date;
  expiresAt: Date;
  deviceInfo: DeviceInfo;
}

export interface ClassLoginInfo {
  id: string;
  loginId: string;
  maxDevices: number;
  currentDevices: number;
  isActive: boolean;
  expiresAt?: Date;
        }
