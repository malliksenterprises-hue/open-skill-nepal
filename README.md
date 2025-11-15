# Open Skill Nepal

A multi-school, multi-teacher EdTech live-class platform for Nepalese education system.

## 🎯 Project Overview

Centralized platform where schools access synchronized, grade-level instruction via single admin login, while students access asynchronous content and recordings.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + WebSocket
- **Real-time**: WebRTC + LiveKit SFU
- **Database**: PostgreSQL (Google Cloud SQL)
- **Infrastructure**: Google Cloud Run + Vercel
- **Storage**: Google Cloud Storage

## 👥 User Roles

1. **Super Admin**: Full system control
2. **Admin/Sub Admin**: School verification, teacher assignment, scheduling
3. **School Admin**: Single credential per school for all live classes
4. **Teachers**: Conduct live classes, share media, manage interactions
5. **Students**: Access recordings and pre-recorded content (NO live class access)

## 🚀 Key Features

- Multi-school live class aggregation
- Device limit enforcement per school
- Automated recording and storage
- Google OAuth for students
- Real-time classroom interactions

## 📁 Project Structure
