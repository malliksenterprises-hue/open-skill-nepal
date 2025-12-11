import deviceValidationService from '@/services/DeviceValidationService';

// Mock fingerprintjs
jest.mock('@fingerprintjs/fingerprintjs', () => ({
  load: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue({
      visitorId: 'test-fingerprint-123'
    })
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

describe('DeviceValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  describe('getDeviceFingerprint', () => {
    it('should return stored fingerprint if available', async () => {
      localStorageMock.getItem.mockReturnValue('stored-fingerprint-123');
      
      const fingerprint = await deviceValidationService.getDeviceFingerprint();
      
      expect(fingerprint).toBe('stored-fingerprint-123');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('edu_device_fingerprint');
    });

    it('should generate and store new fingerprint if not available', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const fingerprint = await deviceValidationService.getDeviceFingerprint();
      
      expect(fingerprint).toBe('test-fingerprint-123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'edu_device_fingerprint',
        'test-fingerprint-123'
      );
    });
  });

  describe('getDeviceId', () => {
    it('should return stored device ID if available', () => {
      localStorageMock.getItem.mockReturnValue('stored-device-id');
      
      const deviceId = deviceValidationService.getDeviceId();
      
      expect(deviceId).toBe('stored-device-id');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('edu_device_id');
    });

    it('should generate and store new device ID if not available', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const deviceId = deviceValidationService.getDeviceId();
      
      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('edu_device_id', deviceId);
    });
  });

  describe('validateDevice', () => {
    const mockUser = {
      id: 'user-123',
      schoolId: 'school-456'
    };

    beforeEach(() => {
      // Mock successful API response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: true,
          limit: 3,
          current: 1,
          isNewDevice: false
        })
      });

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'edu_device_fingerprint') return 'test-fingerprint';
        if (key === 'edu_device_id') return 'test-device-id';
        return null;
      });
    });

    it('should validate device successfully', async () => {
      const result = await deviceValidationService.validateDevice(
        mockUser.id,
        mockUser.schoolId,
        'live-class'
      );

      expect(result.valid).toBe(true);
      expect(result.deviceFingerprint).toBe('test-fingerprint');
      expect(fetch).toHaveBeenCalledWith('/api/devices/validate', expect.any(Object));
    });

    it('should use cached validation if recent', async () => {
      // Mock recent validation in cache
      const recentValidation = {
        timestamp: Date.now() - 1000, // 1 second ago
        data: {
          valid: true,
          limit: 3,
          current: 1,
          cached: true
        }
      };
      
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'edu_last_device_validation') {
          return JSON.stringify(recentValidation);
        }
        return null;
      });

      const result = await deviceValidationService.validateDevice(
        mockUser.id,
        mockUser.schoolId,
        'live-class'
      );

      expect(result.cached).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fail open on validation error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await deviceValidationService.validateDevice(
        mockUser.id,
        mockUser.schoolId,
        'live-class'
      );

      expect(result.valid).toBe(true);
      expect(result.allowAccess).toBe(true);
      expect(result.error).toBe(true);
    });
  });

  describe('shouldShowDeviceWarning', () => {
    it('should return true for device limit exceeded', () => {
      const validationResult = {
        valid: false,
        reason: 'device-limit-exceeded'
      };

      const shouldShow = deviceValidationService.shouldShowDeviceWarning(validationResult);
      expect(shouldShow).toBe(true);
    });

    it('should return false for valid device', () => {
      const validationResult = {
        valid: true,
        reason: null
      };

      const shouldShow = deviceValidationService.shouldShowDeviceWarning(validationResult);
      expect(shouldShow).toBe(false);
    });
  });

  describe('clearDeviceData', () => {
    it('should clear all device data from localStorage', () => {
      deviceValidationService.clearDeviceData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('edu_device_id');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('edu_device_fingerprint');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('edu_last_device_validation');
    });
  });
});
