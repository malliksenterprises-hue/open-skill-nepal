/**
 * Cloud Storage Utility
 * 
 * Google Cloud Storage integration for Open Skill Nepal backend.
 * Handles file uploads, downloads, and management for:
 * - Recorded class videos
 * - Teacher notes and materials
 * - User profile pictures
 * - School documents
 * 
 * @module utils/cloudStorage
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const stream = require('stream');
const logger = require('./logger');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'open-skill-nepal-storage';
const GCS_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const GCS_KEY_FILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Initialize Google Cloud Storage
let storage;
let bucket;

try {
    if (IS_PRODUCTION) {
        // In production (Cloud Run), use default credentials
        storage = new Storage({
            projectId: GCS_PROJECT_ID,
            // credentials will be automatically picked up from environment
        });
    } else if (GCS_KEY_FILE && fs.access) {
        // In development with service account key file
        storage = new Storage({
            projectId: GCS_PROJECT_ID,
            keyFilename: GCS_KEY_FILE
        });
    } else {
        // Local development without credentials (filesystem fallback)
        storage = null;
        logger.warn('Google Cloud Storage not configured. Using filesystem fallback.');
    }

    if (storage) {
        bucket = storage.bucket(GCS_BUCKET_NAME);
        logger.info('Google Cloud Storage initialized', {
            bucket: GCS_BUCKET_NAME,
            projectId: GCS_PROJECT_ID,
            environment: NODE_ENV
        });
    }
} catch (error) {
    logger.error('Failed to initialize Google Cloud Storage:', error);
    storage = null;
    bucket = null;
}

/**
 * File types and their configurations
 */
const FILE_CONFIGS = {
    'video/mp4': {
        maxSize: 1024 * 1024 * 1024, // 1GB for videos
        allowed: true,
        folder: 'videos',
        public: false
    },
    'video/webm': {
        maxSize: 1024 * 1024 * 1024, // 1GB
        allowed: true,
        folder: 'videos',
        public: false
    },
    'application/pdf': {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowed: true,
        folder: 'documents',
        public: false
    },
    'image/jpeg': {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowed: true,
        folder: 'images',
        public: true
    },
    'image/png': {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowed: true,
        folder: 'images',
        public: true
    },
    'image/gif': {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowed: true,
        folder: 'images',
        public: true
    },
    'application/zip': {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowed: true,
        folder: 'archives',
        public: false
    },
    'text/plain': {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowed: true,
        folder: 'text',
        public: false
    }
};

/**
 * Generates a secure file name to prevent collisions and path traversal
 * 
 * @param {string} originalName - Original file name
 * @param {string} userId - User ID who uploaded the file
 * @param {string} fileType - MIME type of the file
 * @returns {Object} File metadata including safe name and path
 */
function generateSafeFileName(originalName, userId, fileType) {
    try {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const fileExtension = path.extname(originalName) || getExtensionFromMimeType(fileType);
        
        // Sanitize original name
        const sanitizedName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 100);
        
        // Create safe file name
        const safeFileName = `${timestamp}_${randomString}_${sanitizedName}`;
        
        // Get folder from file config
        const config = FILE_CONFIGS[fileType] || FILE_CONFIGS['application/octet-stream'];
        const folder = config.folder || 'misc';
        
        // Generate path
        const filePath = `${folder}/${userId}/${safeFileName}`;
        
        return {
            originalName: originalName,
            safeFileName: safeFileName,
            filePath: filePath,
            fileExtension: fileExtension,
            folder: folder,
            timestamp: timestamp
        };
    } catch (error) {
        logger.error('Error generating safe file name:', error);
        throw new Error('Failed to generate file name');
    }
}

/**
 * Gets file extension from MIME type
 * 
 * @param {string} mimeType - MIME type
 * @returns {string} File extension
 */
function getExtensionFromMimeType(mimeType) {
    const extensions = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'application/zip': '.zip',
        'text/plain': '.txt'
    };
    
    return extensions[mimeType] || '.bin';
}

/**
 * Validates file before upload
 * 
 * @param {Object} file - File object (Express multer file)
 * @returns {Object} Validation result
 */
function validateFile(file) {
    const result = {
        isValid: false,
        error: null,
        config: null
    };
    
    if (!file) {
        result.error = 'No file provided';
        return result;
    }
    
    const config = FILE_CONFIGS[file.mimetype];
    
    if (!config) {
        result.error = `File type not allowed: ${file.mimetype}`;
        return result;
    }
    
    if (file.size > config.maxSize) {
        result.error = `File too large. Maximum size: ${config.maxSize / 1024 / 1024}MB`;
        return result;
    }
    
    result.isValid = true;
    result.config = config;
    return result;
}

/**
 * Uploads a file to Google Cloud Storage
 * 
 * @param {Object} file - File object (Express multer file)
 * @param {string} userId - User ID who uploaded the file
 * @param {Object} metadata - Additional file metadata
 * @returns {Promise<Object>} Upload result with file info
 */
async function uploadFile(file, userId, metadata = {}) {
    try {
        // Validate file
        const validation = validateFile(file);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }
        
        // Generate safe file name
        const fileInfo = generateSafeFileName(file.originalname, userId, file.mimetype);
        
        // Prepare metadata
        const fileMetadata = {
            contentType: file.mimetype,
            metadata: {
                originalName: fileInfo.originalName,
                uploadedBy: userId,
                uploadedAt: new Date().toISOString(),
                size: file.size,
                ...metadata
            }
        };
        
        let uploadResult;
        
        if (storage && bucket) {
            // Upload to Google Cloud Storage
            const gcsFile = bucket.file(fileInfo.filePath);
            
            // Create write stream
            const writeStream = gcsFile.createWriteStream({
                metadata: fileMetadata,
                resumable: false,
                validation: 'md5'
            });
            
            // Handle stream events
            uploadResult = await new Promise((resolve, reject) => {
                writeStream.on('error', (error) => {
                    logger.error('GCS upload stream error:', error);
                    reject(new Error('File upload failed'));
                });
                
                writeStream.on('finish', async () => {
                    try {
                        // Make file public if configured
                        if (validation.config.public) {
                            await gcsFile.makePublic();
                        }
                        
                        // Get public URL
                        const publicUrl = validation.config.public 
                            ? `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileInfo.filePath}`
                            : null;
                        
                        // Get signed URL for private files (valid for 7 days)
                        let signedUrl = null;
                        if (!validation.config.public) {
                            const [url] = await gcsFile.getSignedUrl({
                                action: 'read',
                                expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                                version: 'v4'
                            });
                            signedUrl = url;
                        }
                        
                        resolve({
                            success: true,
                            fileId: fileInfo.safeFileName,
                            filePath: fileInfo.filePath,
                            originalName: fileInfo.originalName,
                            mimeType: file.mimetype,
                            size: file.size,
                            publicUrl: publicUrl,
                            signedUrl: signedUrl,
                            bucket: GCS_BUCKET_NAME,
                            metadata: fileMetadata.metadata,
                            uploadedAt: new Date().toISOString()
                        });
                    } catch (error) {
                        logger.error('Error finalizing upload:', error);
                        reject(new Error('Failed to finalize upload'));
                    }
                });
                
                // Write file buffer to stream
                writeStream.end(file.buffer);
            });
        } else {
            // Fallback to filesystem (development only)
            uploadResult = await uploadToFilesystem(file, userId, fileInfo, fileMetadata);
        }
        
        logger.info('File uploaded successfully', {
            userId,
            filePath: fileInfo.filePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            bucket: storage ? GCS_BUCKET_NAME : 'filesystem'
        });
        
        return uploadResult;
        
    } catch (error) {
        logger.error('File upload failed:', {
            error: error.message,
            userId,
            originalName: file?.originalname
        });
        throw error;
    }
}

/**
 * Filesystem fallback for development
 */
async function uploadToFilesystem(file, userId, fileInfo, metadata) {
    const uploadDir = path.join(process.cwd(), 'uploads', fileInfo.folder, userId);
    
    try {
        // Create directory if it doesn't exist
        await fs.mkdir(uploadDir, { recursive: true });
        
        // Write file
        const filePath = path.join(uploadDir, fileInfo.safeFileName);
        await fs.writeFile(filePath, file.buffer);
        
        // Create metadata file
        const metaPath = `${filePath}.meta.json`;
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
        
        return {
            success: true,
            fileId: fileInfo.safeFileName,
            filePath: filePath,
            originalName: fileInfo.originalName,
            mimeType: file.mimetype,
            size: file.size,
            publicUrl: null,
            signedUrl: `/uploads/${fileInfo.folder}/${userId}/${fileInfo.safeFileName}`,
            bucket: 'filesystem',
            metadata: metadata.metadata,
            uploadedAt: new Date().toISOString(),
            isFallback: true
        };
    } catch (error) {
        logger.error('Filesystem upload failed:', error);
        throw new Error('Failed to upload file to filesystem');
    }
}

/**
 * Gets a signed URL for private file access
 * 
 * @param {string} filePath - File path in storage
 * @param {number} expiresIn - Expiration time in milliseconds (default: 1 hour)
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(filePath, expiresIn = 3600000) {
    try {
        if (!storage || !bucket) {
            throw new Error('Cloud Storage not initialized');
        }
        
        const file = bucket.file(filePath);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error('File not found');
        }
        
        // Generate signed URL
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresIn,
            version: 'v4'
        });
        
        return url;
    } catch (error) {
        logger.error('Error generating signed URL:', error);
        throw error;
    }
}

/**
 * Downloads a file from storage
 * 
 * @param {string} filePath - File path in storage
 * @returns {Promise<stream.Readable>} Readable stream
 */
async function downloadFile(filePath) {
    try {
        if (!storage || !bucket) {
            throw new Error('Cloud Storage not initialized');
        }
        
        const file = bucket.file(filePath);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            throw new Error('File not found');
        }
        
        // Create read stream
        return file.createReadStream();
    } catch (error) {
        logger.error('Error downloading file:', error);
        throw error;
    }
}

/**
 * Deletes a file from storage
 * 
 * @param {string} filePath - File path in storage
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(filePath) {
    try {
        if (!storage || !bucket) {
            // Handle filesystem fallback
            const fullPath = path.join(process.cwd(), 'uploads', filePath);
            try {
                await fs.unlink(fullPath);
                // Also delete metadata file if exists
                const metaPath = `${fullPath}.meta.json`;
                await fs.unlink(metaPath).catch(() => {});
                return true;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return false; // File didn't exist
                }
                throw error;
            }
        }
        
        const file = bucket.file(filePath);
        await file.delete();
        
        logger.info('File deleted', { filePath });
        return true;
    } catch (error) {
        // If file doesn't exist, that's okay
        if (error.code === 404) {
            return false;
        }
        
        logger.error('Error deleting file:', error);
        throw error;
    }
}

/**
 * Lists files in a folder with pagination
 * 
 * @param {string} folder - Folder path
 * @param {Object} options - Listing options
 * @returns {Promise<Object>} List of files
 */
async function listFiles(folder, options = {}) {
    try {
        const {
            page = 1,
            limit = 50,
            prefix = '',
            delimiter = '/'
        } = options;
        
        if (!storage || !bucket) {
            // Filesystem fallback
            return listFilesFromFilesystem(folder, options);
        }
        
        const queryOptions = {
            prefix: folder ? `${folder}/${prefix}` : prefix,
            delimiter: delimiter
        };
        
        if (page > 1) {
            // Note: GCS doesn't have built-in pagination by page number
            // This is a simplified implementation
            queryOptions.maxResults = page * limit;
        }
        
        const [files, , apiResponse] = await bucket.getFiles(queryOptions);
        
        // Apply pagination manually
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedFiles = files.slice(startIndex, endIndex);
        
        // Extract file information
        const fileList = await Promise.all(
            paginatedFiles.map(async (file) => {
                const [metadata] = await file.getMetadata();
                return {
                    name: file.name,
                    size: parseInt(metadata.size || 0),
                    contentType: metadata.contentType,
                    updated: metadata.updated,
                    metadata: metadata.metadata || {},
                    publicUrl: metadata.mediaLink
                };
            })
        );
        
        return {
            files: fileList,
            pagination: {
                page,
                limit,
                total: files.length,
                pages: Math.ceil(files.length / limit),
                hasMore: endIndex < files.length
            },
            folder: folder || '/'
        };
    } catch (error) {
        logger.error('Error listing files:', error);
        throw error;
    }
}

/**
 * Filesystem fallback for listing files
 */
async function listFilesFromFilesystem(folder, options) {
    const uploadDir = path.join(process.cwd(), 'uploads', folder || '');
    
    try {
        await fs.access(uploadDir);
    } catch {
        return {
            files: [],
            pagination: {
                page: options.page || 1,
                limit: options.limit || 50,
                total: 0,
                pages: 0,
                hasMore: false
            },
            folder: folder || '/'
        };
    }
    
    const files = await fs.readdir(uploadDir);
    const fileStats = await Promise.all(
        files.map(async (filename) => {
            try {
                const filePath = path.join(uploadDir, filename);
                const stat = await fs.stat(filePath);
                
                // Skip metadata files
                if (filename.endsWith('.meta.json')) {
                    return null;
                }
                
                // Try to read metadata
                let metadata = {};
                try {
                    const metaPath = `${filePath}.meta.json`;
                    const metaContent = await fs.readFile(metaPath, 'utf8');
                    metadata = JSON.parse(metaContent).metadata || {};
                } catch {
                    // Metadata not found, that's okay
                }
                
                return {
                    name: filename,
                    size: stat.size,
                    contentType: getMimeTypeFromExtension(filename),
                    updated: stat.mtime,
                    metadata: metadata,
                    publicUrl: null
                };
            } catch {
                return null;
            }
        })
    );
    
    const validFiles = fileStats.filter(Boolean);
    
    // Apply pagination
    const startIndex = ((options.page || 1) - 1) * (options.limit || 50);
    const endIndex = startIndex + (options.limit || 50);
    const paginatedFiles = validFiles.slice(startIndex, endIndex);
    
    return {
        files: paginatedFiles,
        pagination: {
            page: options.page || 1,
            limit: options.limit || 50,
            total: validFiles.length,
            pages: Math.ceil(validFiles.length / (options.limit || 50)),
            hasMore: endIndex < validFiles.length
        },
        folder: folder || '/'
    };
}

/**
 * Gets MIME type from file extension
 */
function getMimeTypeFromExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.zip': 'application/zip',
        '.txt': 'text/plain'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Copies a file within storage
 * 
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {Promise<boolean>} Success status
 */
async function copyFile(sourcePath, destPath) {
    try {
        if (!storage || !bucket) {
            throw new Error('Cloud Storage not initialized');
        }
        
        const sourceFile = bucket.file(sourcePath);
        const destFile = bucket.file(destPath);
        
        await sourceFile.copy(destFile);
        
        logger.info('File copied', { sourcePath, destPath });
        return true;
    } catch (error) {
        logger.error('Error copying file:', error);
        throw error;
    }
}

/**
 * Gets file metadata
 * 
 * @param {string} filePath - File path in storage
 * @returns {Promise<Object>} File metadata
 */
async function getFileMetadata(filePath) {
    try {
        if (!storage || !bucket) {
            // Filesystem fallback
            return getFileMetadataFromFilesystem(filePath);
        }
        
        const file = bucket.file(filePath);
        const [metadata] = await file.getMetadata();
        
        return {
            name: file.name,
            size: parseInt(metadata.size || 0),
            contentType: metadata.contentType,
            created: metadata.timeCreated,
            updated: metadata.updated,
            metadata: metadata.metadata || {},
            md5Hash: metadata.md5Hash,
            publicUrl: metadata.mediaLink
        };
    } catch (error) {
        logger.error('Error getting file metadata:', error);
        throw error;
    }
}

/**
 * Filesystem fallback for getting metadata
 */
async function getFileMetadataFromFilesystem(filePath) {
    const fullPath = path.join(process.cwd(), 'uploads', filePath);
    
    try {
        const stat = await fs.stat(fullPath);
        
        // Try to read metadata file
        let metadata = {};
        try {
            const metaPath = `${fullPath}.meta.json`;
            const metaContent = await fs.readFile(metaPath, 'utf8');
            metadata = JSON.parse(metaContent).metadata || {};
        } catch {
            // Metadata not found
        }
        
        return {
            name: path.basename(filePath),
            size: stat.size,
            contentType: getMimeTypeFromExtension(filePath),
            created: stat.birthtime,
            updated: stat.mtime,
            metadata: metadata,
            md5Hash: null,
            publicUrl: null
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('File not found');
        }
        throw error;
    }
}

/**
 * Creates a folder in storage
 * 
 * @param {string} folderPath - Folder path to create
 * @returns {Promise<boolean>} Success status
 */
async function createFolder(folderPath) {
    try {
        if (!storage || !bucket) {
            // Filesystem fallback - create directory
            const fullPath = path.join(process.cwd(), 'uploads', folderPath);
            await fs.mkdir(fullPath, { recursive: true });
            return true;
        }
        
        // In GCS, folders don't actually exist - they're just path prefixes
        // We'll create a dummy file to represent the folder
        const folderMarker = `${folderPath}/.folder`;
        const file = bucket.file(folderMarker);
        
        await file.save('', {
            metadata: {
                contentType: 'application/x-directory',
                metadata: {
                    isFolderMarker: 'true',
                    created: new Date().toISOString()
                }
            }
        });
        
        return true;
    } catch (error) {
        logger.error('Error creating folder:', error);
        throw error;
    }
}

module.exports = {
    // Configuration
    FILE_CONFIGS,
    GCS_BUCKET_NAME,
    IS_PRODUCTION,
    
    // Core functions
    uploadFile,
    downloadFile,
    deleteFile,
    getSignedUrl,
    listFiles,
    copyFile,
    getFileMetadata,
    createFolder,
    
    // Utility functions
    validateFile,
    generateSafeFileName,
    getExtensionFromMimeType,
    
    // Storage status
    isStorageAvailable: () => {
        return !!(storage && bucket);
    },
    
    // Initialize storage (for manual initialization)
    initialize: () => {
        return { storage, bucket };
    }
};
