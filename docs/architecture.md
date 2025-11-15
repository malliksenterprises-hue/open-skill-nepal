# Open Skill Nepal - System Architecture

## Overview
Multi-tenant EdTech platform with centralized live-class access for schools.

## Core Components

### 1. Frontend (Next.js on Vercel)
- Role-based dashboards
- Real-time WebRTC interface
- Responsive design for all devices

### 2. Backend (Node.js on Google Cloud Run)
- Express REST API
- WebSocket signaling server
- Authentication & authorization
- Device limit enforcement

### 3. Real-time Communication (LiveKit SFU)
- WebRTC media streaming
- Screen sharing capabilities
- Automatic recording
- Scalable video distribution

### 4. Database (Google Cloud SQL - PostgreSQL)
- User management
- Class scheduling
- Recording metadata
- Device limit tracking

### 5. Storage (Google Cloud Storage)
- Class recordings (1-year retention)
- Course materials
- Static assets

## Data Flow

1. **Teacher** starts class → Backend API → LiveKit room creation
2. **School Admin** joins → WebSocket signaling → Device limit check → LiveKit connection
3. **Media Stream** → LiveKit SFU → Recording pipeline → Cloud Storage
4. **Students** access → Recording URLs → Cloud Storage via CDN

## Security Model

- JWT-based authentication
- Role-based access control
- Per-school device limits
- Student live-class access blocking
- HTTPS/WSS encryption
