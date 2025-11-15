#!/bin/bash

# Open Skill Nepal - GCP Infrastructure Setup Script

echo "🚀 Setting up Google Cloud Platform infrastructure for Open Skill Nepal..."

# Set variables
PROJECT_ID="open-skill-nepal"
REGION="asia-south1"
ZONE="asia-south1-a"

# Create GCP project
echo "📁 Creating GCP project..."
gcloud projects create $PROJECT_ID --name="Open Skill Nepal"

# Set current project
gcloud config set project $PROJECT_ID

# Enable required services
echo "🔧 Enabling GCP services..."
gcloud services enable \
    run.googleapis.com \
    sql-admin.googleapis.com \
    storage.googleapis.com \
    cloudbuild.googleapis.com \
    iam.googleapis.com \
    compute.googleapis.com

# Create Cloud SQL PostgreSQL instance
echo "🗄️ Creating Cloud SQL database..."
gcloud sql instances create open-skill-db \
    --database-version=POSTGRES_13 \
    --tier=db-f1-micro \
    --region=$REGION \
    --storage-size=10GB

# Create database
gcloud sql databases create open_skill --instance=open-skill-db

# Create Cloud Storage bucket for recordings
echo "📦 Creating Cloud Storage bucket..."
gsutil mb -l $REGION gs://$PROJECT_ID-recordings

echo "✅ GCP infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure database password: gcloud sql users set-password postgres --instance=open-skill-db --password=YOUR_PASSWORD"
echo "2. Deploy backend: cd backend && gcloud run deploy"
echo "3. Deploy frontend: cd frontend && vercel --prod"
