/**
 * Email Service Utility
 * 
 * Email notification system for Open Skill Nepal platform.
 * Handles transactional emails for:
 * - Class Login credentials
 * - Teacher account creation
 * - Password reset
 * - Live class notifications
 * - Admin alerts
 * 
 * @module utils/emailService
 */

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';
const DEFAULT_FROM_EMAIL = process.env.DEFAULT_FROM_EMAIL || 'noreply@openskillnepal.com';
const DEFAULT_FROM_NAME = process.env.DEFAULT_FROM_NAME || 'Open Skill Nepal';

// Email service configuration
let transporter = null;
let emailTemplates = {};
let oauth2Client = null;

/**
 * Email template types and configurations
 */
const EMAIL_TEMPLATES = {
    // Authentication emails
    CLASS_LOGIN_CREATED: {
        subject: 'Your Class Login Credentials - Open Skill Nepal',
        template: 'class-login-created',
        category: 'authentication'
    },
    TEACHER_ACCOUNT_CREATED: {
        subject: 'Welcome to Open Skill Nepal - Teacher Account',
        template: 'teacher-account-created',
        category: 'authentication'
    },
    PASSWORD_RESET_REQUEST: {
        subject: 'Reset Your Password - Open Skill Nepal',
        template: 'password-reset-request',
        category: 'authentication'
    },
    PASSWORD_RESET_SUCCESS: {
        subject: 'Password Reset Successful - Open Skill Nepal',
        template: 'password-reset-success',
        category: 'authentication'
    },
    
    // Live class notifications
    LIVE_CLASS_SCHEDULED: {
        subject: 'Live Class Scheduled - {className}',
        template: 'live-class-scheduled',
        category: 'notification'
    },
    LIVE_CLASS_STARTING_SOON: {
        subject: 'Live Class Starting Soon - {className}',
        template: 'live-class-starting-soon',
        category: 'notification'
    },
    LIVE_CLASS_RECORDING_AVAILABLE: {
        subject: 'Recording Available - {className}',
        template: 'live-class-recording-available',
        category: 'notification'
    },
    
    // Admin notifications
    DEVICE_LIMIT_EXCEEDED: {
        subject: 'Device Limit Exceeded Alert',
        template: 'device-limit-exceeded',
        category: 'alert'
    },
    NEW_SCHOOL_REGISTERED: {
        subject: 'New School Registered - {schoolName}',
        template: 'new-school-registered',
        category: 'alert'
    },
    SYSTEM_ALERT: {
        subject: 'System Alert - {alertType}',
        template: 'system-alert',
        category: 'alert'
    },
    
    // Student notifications
    NEW_MATERIAL_AVAILABLE: {
        subject: 'New Study Material Available - {className}',
        template: 'new-material-available',
        category: 'notification'
    },
    ASSIGNMENT_REMINDER: {
        subject: 'Assignment Reminder - {assignmentTitle}',
        template: 'assignment-reminder',
        category: 'notification'
    }
};

/**
 * Initializes the email service
 */
async function initializeEmailService() {
    try {
        if (!EMAIL_ENABLED) {
            logger.warn('Email service is disabled by configuration');
            return false;
        }

        // Load email templates
        await loadEmailTemplates();

        // Configure email transporter based on environment
        if (IS_PRODUCTION) {
            await configureProductionTransporter();
        } else {
            await configureDevelopmentTransporter();
        }

        if (!transporter) {
            throw new Error('Failed to initialize email transporter');
        }

        // Verify transporter connection
        await transporter.verify();
        
        logger.info('Email service initialized successfully', {
            environment: NODE_ENV,
            fromEmail: DEFAULT_FROM_EMAIL,
            enabled: EMAIL_ENABLED
        });

        return true;
    } catch (error) {
        logger.error('Failed to initialize email service:', error);
        return false;
    }
}

/**
 * Loads email templates from files
 */
async function loadEmailTemplates() {
    const templatesDir = path.join(__dirname, '../../email-templates');
    
    try {
        await fs.access(templatesDir);
    } catch {
        // Templates directory doesn't exist, use default templates
        logger.warn('Email templates directory not found, using default templates');
        createDefaultTemplates();
        return;
    }

    try {
        const files = await fs.readdir(templatesDir);
        
        for (const file of files) {
            if (file.endsWith('.html') || file.endsWith('.hbs')) {
                const templateName = path.basename(file, path.extname(file));
                const templatePath = path.join(templatesDir, file);
                const templateContent = await fs.readFile(templatePath, 'utf8');
                
                emailTemplates[templateName] = handlebars.compile(templateContent);
                
                logger.debug('Email template loaded', { template: templateName });
            }
        }
        
        logger.info('Email templates loaded', { count: Object.keys(emailTemplates).length });
    } catch (error) {
        logger.error('Error loading email templates:', error);
        createDefaultTemplates();
    }
}

/**
 * Creates default in-memory templates
 */
function createDefaultTemplates() {
    // Class Login Created Template
    emailTemplates['class-login-created'] = handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class Login Credentials</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .credentials { background: white; border: 2px solid #4CAF50; border-radius: 5px; padding: 20px; margin: 20px 0; }
        .field { margin-bottom: 10px; }
        .label { font-weight: bold; color: #555; }
        .value { font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 3px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Open Skill Nepal</h1>
        <p>Class Login Credentials</p>
    </div>
    
    <div class="content">
        <h2>Hello {{teacherName}},</h2>
        
        <p>Your class login credentials have been created for <strong>{{className}}</strong>.</p>
        
        <div class="credentials">
            <div class="field">
                <span class="label">Class Name:</span>
                <div class="value">{{className}}</div>
            </div>
            <div class="field">
                <span class="label">Class Login ID:</span>
                <div class="value">{{classLoginId}}</div>
            </div>
            <div class="field">
                <span class="label">Password:</span>
                <div class="value">{{password}}</div>
            </div>
            {{#if section}}
            <div class="field">
                <span class="label">Section:</span>
                <div class="value">{{section}}</div>
            </div>
            {{/if}}
            <div class="field">
                <span class="label">Device Limit:</span>
                <div class="value">{{deviceLimit}} device(s)</div>
            </div>
        </div>
        
        <div class="warning">
            <strong>Important:</strong> 
            <ul>
                <li>Share these credentials with your students for live class access</li>
                <li>Students can only join live classes using these credentials</li>
                <li>Maximum {{deviceLimit}} devices can be connected simultaneously</li>
                <li>Do not share these credentials publicly</li>
            </ul>
        </div>
        
        <p>To join live classes, students should visit: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
        
        <p>If you have any questions, please contact your school administrator.</p>
        
        <p>Best regards,<br>
        Open Skill Nepal Team</p>
    </div>
    
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>© {{currentYear}} Open Skill Nepal. All rights reserved.</p>
    </div>
</body>
</html>
    `);

    // Teacher Account Created Template
    emailTemplates['teacher-account-created'] = handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Account Created</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .credentials { background: white; border: 2px solid #2196F3; border-radius: 5px; padding: 20px; margin: 20px 0; }
        .field { margin-bottom: 10px; }
        .label { font-weight: bold; color: #555; }
        .value { font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 3px; }
        .steps { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .step { margin-bottom: 15px; }
        .step-number { background: #2196F3; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Open Skill Nepal</h1>
        <p>Teacher Account Created</p>
    </div>
    
    <div class="content">
        <h2>Welcome {{teacherName}}!</h2>
        
        <p>Your teacher account has been created for <strong>{{schoolName}}</strong>.</p>
        
        <div class="credentials">
            <div class="field">
                <span class="label">Email:</span>
                <div class="value">{{email}}</div>
            </div>
            <div class="field">
                <span class="label">Temporary Password:</span>
                <div class="value">{{password}}</div>
            </div>
            <div class="field">
                <span class="label">School:</span>
                <div class="value">{{schoolName}}</div>
            </div>
            {{#if subjects}}
            <div class="field">
                <span class="label">Subjects:</span>
                <div class="value">{{subjects}}</div>
            </div>
            {{/if}}
        </div>
        
        <div class="steps">
            <h3>Getting Started:</h3>
            
            <div class="step">
                <span class="step-number">1</span>
                <strong>Login to your account</strong> at <a href="{{loginUrl}}">{{loginUrl}}</a>
            </div>
            
            <div class="step">
                <span class="step-number">2</span>
                <strong>Change your password</strong> immediately after first login
            </div>
            
            <div class="step">
                <span class="step-number">3</span>
                <strong>Set up your profile</strong> and add your teaching information
            </div>
            
            <div class="step">
                <span class="step-number">4</span>
                <strong>Create Class Logins</strong> for your students to join live classes
            </div>
            
            <div class="step">
                <span class="step-number">5</span>
                <strong>Schedule live classes</strong> and start teaching!
            </div>
        </div>
        
        <p>As a verified teacher on Open Skill Nepal, you can:</p>
        <ul>
            <li>Conduct live classes with screen sharing</li>
            <li>Control student microphones and webcams</li>
            <li>Share study materials and notes</li>
            <li>Record classes for later viewing</li>
            <li>Manage student participation</li>
        </ul>
        
        <p>If you need assistance, please contact: {{adminEmail}}</p>
        
        <p>Best regards,<br>
        Open Skill Nepal Team</p>
    </div>
    
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>© {{currentYear}} Open Skill Nepal. All rights reserved.</p>
    </div>
</body>
</html>
    `);

    // Password Reset Template
    emailTemplates['password-reset-request'] = handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .reset-button { display: inline-block; background: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Open Skill Nepal</h1>
        <p>Password Reset Request</p>
    </div>
    
    <div class="content">
        <h2>Hello {{userName}},</h2>
        
        <p>We received a request to reset your password for your Open Skill Nepal account.</p>
        
        <div class="info">
            <p><strong>Account:</strong> {{userEmail}}<br>
            <strong>Requested:</strong> {{requestTime}}<br>
            <strong>IP Address:</strong> {{ipAddress}}</p>
        </div>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center;">
            <a href="{{resetUrl}}" class="reset-button">Reset Password</a>
        </div>
        
        <p>Or copy and paste this link into your browser:<br>
        <code style="background: #f5f5f5; padding: 5px 10px; border-radius: 3px; word-break: break-all;">{{resetUrl}}</code></p>
        
        <div class="warning">
            <strong>Important:</strong>
            <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Your password will not change until you create a new one</li>
            </ul>
        </div>
        
        <p>If you're having trouble clicking the button, copy and paste the URL above into your web browser.</p>
        
        <p>For security reasons, this password reset link can only be used once.</p>
        
        <p>Best regards,<br>
        Open Skill Nepal Team</p>
    </div>
    
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>© {{currentYear}} Open Skill Nepal. All rights reserved.</p>
    </div>
</body>
</html>
    `);

    logger.info('Default email templates created');
}

/**
 * Configures production email transporter (Gmail OAuth2)
 */
async function configureProductionTransporter() {
    try {
        const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
        const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
        const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
        const ACCESS_TOKEN = process.env.GMAIL_ACCESS_TOKEN;

        if (!CLIENT_ID || !CLIENT_SECRET) {
            logger.warn('Gmail OAuth2 credentials not found, using SMTP fallback');
            return configureSMTPTransporter();
        }

        // Create OAuth2 client
        oauth2Client = new google.auth.OAuth2(
            CLIENT_ID,
            CLIENT_SECRET,
            'https://developers.google.com/oauthplayground'
        );

        // Set credentials
        oauth2Client.setCredentials({
            refresh_token: REFRESH_TOKEN,
            access_token: ACCESS_TOKEN
        });

        // Create transporter with OAuth2
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: DEFAULT_FROM_EMAIL,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: ACCESS_TOKEN
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100
        });

        logger.info('Production email transporter configured (Gmail OAuth2)');
    } catch (error) {
        logger.error('Failed to configure production email transporter:', error);
        // Fallback to SMTP
        return configureSMTPTransporter();
    }
}

/**
 * Configures SMTP transporter (fallback for production, primary for development)
 */
async function configureSMTPTransporter() {
    try {
        const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
        const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
        const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
        const SMTP_USER = process.env.SMTP_USER || DEFAULT_FROM_EMAIL;
        const SMTP_PASS = process.env.SMTP_PASS;

        if (!SMTP_USER || !SMTP_PASS) {
            logger.warn('SMTP credentials not found, using development transporter');
            return configureDevelopmentTransporter();
        }

        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            tls: {
                rejectUnauthorized: IS_PRODUCTION
            }
        });

        logger.info('SMTP email transporter configured', {
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            user: SMTP_USER
        });
    } catch (error) {
        logger.error('Failed to configure SMTP transporter:', error);
        return configureDevelopmentTransporter();
    }
}

/**
 * Configures development email transporter (Ethereal or file-based)
 */
async function configureDevelopmentTransporter() {
    try {
        // Try Ethereal.email for testing
        const testAccount = await nodemailer.createTestAccount();
        
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        logger.info('Development email transporter configured (Ethereal)', {
            user: testAccount.user,
            previewUrl: 'https://ethereal.email'
        });
        
        // Log test account info for easy access
        console.log('Ethereal Test Account:');
        console.log('  Email:', testAccount.user);
        console.log('  Password:', testAccount.pass);
        console.log('  Preview: https://ethereal.email');
        
    } catch (error) {
        logger.warn('Failed to create Ethereal account, using file-based email storage');
        
        // File-based email storage for development
        transporter = {
            sendMail: async (mailOptions) => {
                const emailDir = path.join(process.cwd(), 'emails');
                await fs.mkdir(emailDir, { recursive: true });
                
                const filename = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
                const filepath = path.join(emailDir, filename);
                
                const emailData = {
                    ...mailOptions,
                    sentAt: new Date().toISOString(),
                    savedTo: filepath
                };
                
                await fs.writeFile(filepath, JSON.stringify(emailData, null, 2));
                
                logger.info('Email saved to file', { filepath, to: mailOptions.to });
                
                return {
                    messageId: `file-${Date.now()}`,
                    envelope: mailOptions.envelope,
                    accepted: [mailOptions.to],
                    rejected: [],
                    pending: [],
                    response: 'Email saved to file'
                };
            },
            verify: async () => true
        };
        
        logger.info('File-based email storage configured');
    }
}

/**
 * Sends an email
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} options.data - Template data
 * @param {Array} options.attachments - Email attachments
 * @returns {Promise<Object>} Send result
 */
async function sendEmail(options) {
    try {
        if (!EMAIL_ENABLED) {
            logger.warn('Email service disabled, skipping email send', {
                to: options.to,
                template: options.template
            });
            return { success: false, reason: 'EMAIL_SERVICE_DISABLED' };
        }

        if (!transporter) {
            const initialized = await initializeEmailService();
            if (!initialized) {
                throw new Error('Email service not initialized');
            }
        }

        // Get template configuration
        const templateConfig = EMAIL_TEMPLATES[options.template];
        if (!templateConfig) {
            throw new Error(`Email template not found: ${options.template}`);
        }

        // Get template function
        const template = emailTemplates[templateConfig.template];
        if (!template) {
            throw new Error(`Template file not found: ${templateConfig.template}`);
        }

        // Prepare template data
        const templateData = {
            ...options.data,
            currentYear: new Date().getFullYear(),
            loginUrl: process.env.FRONTEND_URL || 'https://openskillnepal.com',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@openskillnepal.com'
        };

        // Render subject
        let subject = templateConfig.subject;
        for (const [key, value] of Object.entries(templateData)) {
            subject = subject.replace(new RegExp(`{${key}}`, 'g'), value);
        }

        // Render HTML content
        const html = template(templateData);

        // Prepare email options
        const mailOptions = {
            from: {
                name: DEFAULT_FROM_NAME,
                address: DEFAULT_FROM_EMAIL
            },
            to: options.to,
            subject: subject,
            html: html,
            envelope: {
                from: DEFAULT_FROM_EMAIL,
                to: options.to
            },
            headers: {
                'X-Email-Template': options.template,
                'X-Email-Category': templateConfig.category,
                'X-Email-System': 'Open-Skill-Nepal'
            }
        };

        // Add CC if specified
        if (options.cc) {
            mailOptions.cc = options.cc;
        }

        // Add BCC if specified
        if (options.bcc) {
            mailOptions.bcc = options.bcc;
        }

        // Add attachments if specified
        if (options.attachments && options.attachments.length > 0) {
            mailOptions.attachments = options.attachments;
        }

        // Send email
        const info = await transporter.sendMail(mailOptions);

        // Log success
        logger.info('Email sent successfully', {
            to: options.to,
            template: options.template,
            messageId: info.messageId,
            category: templateConfig.category
        });

        // In development with Ethereal, log preview URL
        if (info.response && info.response.includes('ethereal')) {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                logger.debug('Ethereal email preview available', { previewUrl });
                console.log('Preview URL:', previewUrl);
            }
        }

        return {
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected
        };

    } catch (error) {
        logger.error('Failed to send email:', {
            error: error.message,
            to: options.to,
            template: options.template
        });
        
        throw error;
    }
}

/**
 * Sends class login credentials email
 * 
 * @param {Object} params - Email parameters
 * @returns {Promise<Object>} Send result
 */
async function sendClassLoginCredentials(params) {
    const {
        teacherEmail,
        teacherName,
        className,
        classLoginId,
        password,
        section,
        deviceLimit,
        schoolName
    } = params;

    return sendEmail({
        to: teacherEmail,
        template: 'CLASS_LOGIN_CREATED',
        data: {
            teacherName,
            className,
            classLoginId,
            password,
            section,
            deviceLimit,
            schoolName
        }
    });
}

/**
 * Sends teacher account creation email
 * 
 * @param {Object} params - Email parameters
 * @returns {Promise<Object>} Send result
 */
async function sendTeacherAccountCreated(params) {
    const {
        teacherEmail,
        teacherName,
        password,
        schoolName,
        subjects,
        adminEmail
    } = params;

    return sendEmail({
        to: teacherEmail,
        template: 'TEACHER_ACCOUNT_CREATED',
        data: {
            teacherName,
            email: teacherEmail,
            password,
            schoolName,
            subjects: Array.isArray(subjects) ? subjects.join(', ') : subjects,
            adminEmail
        }
    });
}

/**
 * Sends password reset email
 * 
 * @param {Object} params - Email parameters
 * @returns {Promise<Object>} Send result
 */
async function sendPasswordReset(params) {
    const {
        userEmail,
        userName,
        resetToken,
        ipAddress
    } = params;

    const resetUrl = `${process.env.FRONTEND_URL || 'https://openskillnepal.com'}/reset-password?token=${resetToken}`;

    return sendEmail({
        to: userEmail,
        template: 'PASSWORD_RESET_REQUEST',
        data: {
            userEmail,
            userName,
            resetUrl,
            ipAddress,
            requestTime: new Date().toLocaleString()
        }
    });
}

/**
 * Sends live class notification email
 * 
 * @param {Object} params - Email parameters
 * @returns {Promise<Object>} Send result
 */
async function sendLiveClassNotification(params) {
    const {
        to,
        className,
        classTime,
        teacherName,
        joinUrl,
        recordingUrl,
        notificationType
    } = params;

    let template;
    switch (notificationType) {
        case 'scheduled':
            template = 'LIVE_CLASS_SCHEDULED';
            break;
        case 'starting_soon':
            template = 'LIVE_CLASS_STARTING_SOON';
            break;
        case 'recording_available':
            template = 'LIVE_CLASS_RECORDING_AVAILABLE';
            break;
        default:
            throw new Error(`Unknown notification type: ${notificationType}`);
    }

    return sendEmail({
        to,
        template,
        data: {
            className,
            classTime,
            teacherName,
            joinUrl,
            recordingUrl
        }
    });
}

/**
 * Sends device limit exceeded alert to admin
 * 
 * @param {Object} params - Alert parameters
 * @returns {Promise<Object>} Send result
 */
async function sendDeviceLimitAlert(params) {
    const {
        adminEmail,
        className,
        classLoginId,
        currentDevices,
        deviceLimit,
        exceededAt
    } = params;

    return sendEmail({
        to: adminEmail,
        template: 'DEVICE_LIMIT_EXCEEDED',
        data: {
            className,
            classLoginId,
            currentDevices,
            deviceLimit,
            exceededAt: new Date(exceededAt).toLocaleString()
        }
    });
}

/**
 * Validates email address format
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} Validation result
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Gets email service status
 * 
 * @returns {Object} Service status
 */
function getServiceStatus() {
    return {
        enabled: EMAIL_ENABLED,
        initialized: !!transporter,
        environment: NODE_ENV,
        fromEmail: DEFAULT_FROM_EMAIL,
        templatesLoaded: Object.keys(emailTemplates).length
    };
}

module.exports = {
    // Core functions
    initializeEmailService,
    sendEmail,
    
    // Specific email functions
    sendClassLoginCredentials,
    sendTeacherAccountCreated,
    sendPasswordReset,
    sendLiveClassNotification,
    sendDeviceLimitAlert,
    
    // Utility functions
    validateEmail,
    getServiceStatus,
    
    // Configuration
    EMAIL_TEMPLATES,
    EMAIL_ENABLED,
    DEFAULT_FROM_EMAIL,
    
    // For testing and debugging
    transporter,
    emailTemplates
};
