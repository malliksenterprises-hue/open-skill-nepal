// MongoDB initialization script
db = db.getSiblingDB('admin');

// Create application database user
db.createUser({
  user: 'openskill_user',
  pwd: 'openskill_password',
  roles: [
    {
      role: 'readWrite',
      db: 'open-skill-nepal'
    },
    {
      role: 'read',
      db: 'admin'
    }
  ]
});

// Create application database
db = db.getSiblingDB('open-skill-nepal');

// Create collections and indexes
db.createCollection('users');
db.createCollection('videos');
db.createCollection('students');
db.createCollection('schools');
db.createCollection('sessions');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.videos.createIndex({ status: 1, scheduledTime: 1 });
db.videos.createIndex({ uploadedBy: 1 });
db.students.createIndex({ schoolId: 1, status: 1 });
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print('✅ MongoDB initialized successfully');
