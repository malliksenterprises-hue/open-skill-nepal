const mongoose = require('mongoose');
const DeviceService = require('../services/DeviceService');
const Device = require('../models/Device');
const School = require('../models/School');
const User = require('../models/User');

// Mock data
const mockUserId = new mongoose.Types.ObjectId();
const mockSchoolId = new mongoose.Types.ObjectId();
const mockDeviceFingerprint = 'test-fingerprint-123';

describe('DeviceService', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/test_liveclasses', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Device.deleteMany({});
    await School.deleteMany({});
    await User.deleteMany({});
  });

  describe('validateDeviceForSession', () => {
    it('should allow first device for new user', async () => {
      const result = await DeviceService.validateDeviceForSession(
        mockUserId,
        mockSchoolId,
        mockDeviceFingerprint,
        'live-class'
      );

      expect(result.valid).toBe(true);
      expect(result.isNewDevice).toBe(true);
    });

    it('should enforce device limits for students', async () => {
      // Create school with student limit of 2
      const school = await School.create({
        _id: mockSchoolId,
        name: 'Test School',
        code: 'TEST123',
        adminId: new mongoose.Types.ObjectId(),
        deviceLimits: {
          student: 2,
          teacher: 5,
          admin: 3
        }
      });

      // Create 2 active devices for student
      await Device.create([
        {
          userId: mockUserId,
          schoolId: mockSchoolId,
          deviceFingerprint: 'device-1',
          userAgent: 'Test Agent',
          isActive: true,
          lastSessionAt: new Date()
        },
        {
          userId: mockUserId,
          schoolId: mockSchoolId,
          deviceFingerprint: 'device-2',
          userAgent: 'Test Agent',
          isActive: true,
          lastSessionAt: new Date()
        }
      ]);

      // Try to add third device
      const result = await DeviceService.validateDeviceForSession(
        mockUserId,
        mockSchoolId,
        'device-3',
        'live-class',
        {},
        'student'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('device-limit-exceeded');
      expect(result.limit).toBe(2);
      expect(result.current).toBe(2);
    });

    it('should allow device if previous one is inactive', async () => {
      // Create school
      await School.create({
        _id: mockSchoolId,
        name: 'Test School',
        code: 'TEST123',
        adminId: new mongoose.Types.ObjectId(),
        deviceLimits: { student: 1 }
      });

      // Create inactive device
      await Device.create({
        userId: mockUserId,
        schoolId: mockSchoolId,
        deviceFingerprint: 'inactive-device',
        userAgent: 'Test Agent',
        isActive: false,
        removedAt: new Date(),
        lastSessionAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago
      });

      // Try to add new device
      const result = await DeviceService.validateDeviceForSession(
        mockUserId,
        mockSchoolId,
        'new-device',
        'live-class',
        {},
        'student'
      );

      expect(result.valid).toBe(true);
    });

    it('should fail open on database error', async () => {
      // Mock database error
      jest.spyOn(Device, 'countDocuments').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const result = await DeviceService.validateDeviceForSession(
        mockUserId,
        mockSchoolId,
        mockDeviceFingerprint,
        'live-class'
      );

      expect(result.valid).toBe(true);
      expect(result.allowAccess).toBe(true);
      expect(result.error).toBe(true);
    });
  });

  describe('updateDeviceSessionInfo', () => {
    it('should create new device if not exists', async () => {
      const deviceInfo = {
        userAgent: 'Mozilla/5.0 Test',
        browser: { name: 'Chrome', version: '91.0' },
        os: { name: 'Windows', version: '10' },
        platform: 'desktop'
      };

      await DeviceService.updateDeviceSessionInfo(
        mockUserId,
        mockSchoolId,
        mockDeviceFingerprint,
        {
          sessionType: 'live-class',
          socketId: 'socket-123',
          ipAddress: '127.0.0.1',
          ...deviceInfo
        }
      );

      const device = await Device.findOne({
        userId: mockUserId,
        deviceFingerprint: mockDeviceFingerprint
      });

      expect(device).toBeTruthy();
      expect(device.sessionCount).toBe(1);
      expect(device.lastSessionType).toBe('live-class');
      expect(device.isActive).toBe(true);
    });

    it('should update existing device', async () => {
      // Create initial device
      await Device.create({
        userId: mockUserId,
        schoolId: mockSchoolId,
        deviceFingerprint: mockDeviceFingerprint,
        userAgent: 'Old Agent',
        sessionCount: 5,
        isActive: false
      });

      await DeviceService.updateDeviceSessionInfo(
        mockUserId,
        mockSchoolId,
        mockDeviceFingerprint,
        {
          sessionType: 'meeting',
          socketId: 'socket-456'
        }
      );

      const device = await Device.findOne({
        userId: mockUserId,
        deviceFingerprint: mockDeviceFingerprint
      });

      expect(device.sessionCount).toBe(6);
      expect(device.lastSessionType).toBe('meeting');
      expect(device.isActive).toBe(true);
      expect(device.updatedAt).toBeTruthy();
    });
  });

  describe('logoutDevice', () => {
    it('should logout specific device', async () => {
      // Create device
      const device = await Device.create({
        userId: mockUserId,
        schoolId: mockSchoolId,
        deviceFingerprint: mockDeviceFingerprint,
        userAgent: 'Test Agent',
        isActive: true
      });

      const result = await DeviceService.logoutDevice(
        mockUserId,
        mockSchoolId,
        device._id
      );

      expect(result.success).toBe(true);
      expect(result.deviceId).toBe(device._id.toString());

      const updatedDevice = await Device.findById(device._id);
      expect(updatedDevice.isActive).toBe(false);
      expect(updatedDevice.removedReason).toBe('device-limit');
      expect(updatedDevice.removedAt).toBeTruthy();
    });

    it('should handle non-existent device gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const result = await DeviceService.logoutDevice(
        mockUserId,
        mockSchoolId,
        nonExistentId
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Device not found');
    });
  });

  describe('cleanupInactiveDevices', () => {
    it('should cleanup devices older than threshold', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      // Create old inactive device
      await Device.create({
        userId: mockUserId,
        schoolId: mockSchoolId,
        deviceFingerprint: 'old-device',
        userAgent: 'Old Agent',
        isActive: true,
        lastSessionAt: thirtyOneDaysAgo
      });

      // Create recent device
      await Device.create({
        userId: mockUserId,
        schoolId: mockSchoolId,
        deviceFingerprint: 'recent-device',
        userAgent: 'Recent Agent',
        isActive: true,
        lastSessionAt: new Date()
      });

      const result = await DeviceService.cleanupInactiveDevices(mockSchoolId);

      expect(result.cleanedCount).toBe(1);

      const oldDevice = await Device.findOne({ deviceFingerprint: 'old-device' });
      const recentDevice = await Device.findOne({ deviceFingerprint: 'recent-device' });

      expect(oldDevice.isActive).toBe(false);
      expect(oldDevice.removedReason).toBe('inactive');
      expect(recentDevice.isActive).toBe(true);
    });
  });
});
