const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class GCPStorage {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      const keyFilePath = path.join(__dirname, '../../service-account.json');
      
      if (!fs.existsSync(keyFilePath)) {
        throw new Error('GCP service account file not found');
      }

      this.storage = new Storage({
        keyFilename: keyFilePath,
        projectId: process.env.GCS_PROJECT_ID || 'open-skill-nepal-478611'
      });

      const bucketName = process.env.GCS_BUCKET_NAME || 'open-skill-nepal-videos';
      this.bucket = this.storage.bucket(bucketName);

      // Test bucket access
      await this.bucket.getMetadata();
      
      this.initialized = true;
      logger.info(`✅ GCP Storage initialized. Bucket: ${bucketName}`);
      
      return this;
    } catch (error) {
      logger.error('❌ GCP Storage initialization failed:', error.message);
      throw error;
    }
  }

  async uploadVideo(fileBuffer, fileName, metadata = {}) {
    if (!this.initialized) {
      throw new Error('GCP Storage not initialized');
    }

    const blob = this.bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: metadata.contentType || 'video/mp4',
        metadata: {
          originalName: metadata.originalName || fileName,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      },
      resumable: false
    });

    return new Promise((resolve, reject) => {
      blobStream.on('error', reject);
      
      blobStream.on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
        
        // Make the file publicly readable
        blob.makePublic()
          .then(() => {
            resolve({
              url: publicUrl,
              fileName,
              bucket: this.bucket.name,
              size: fileBuffer.length,
              uploadedAt: new Date().toISOString()
            });
          })
          .catch(reject);
      });

      blobStream.end(fileBuffer);
    });
  }

  async deleteVideo(fileName) {
    if (!this.initialized) {
      throw new Error('GCP Storage not initialized');
    }

    await this.bucket.file(fileName).delete();
    logger.info(`🗑️  Deleted video: ${fileName}`);
    
    return { success: true, fileName };
  }

  async getVideoUrl(fileName) {
    if (!this.initialized) {
      throw new Error('GCP Storage not initialized');
    }

    const [url] = await this.bucket.file(fileName).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return url;
  }
}

module.exports = new GCPStorage();
