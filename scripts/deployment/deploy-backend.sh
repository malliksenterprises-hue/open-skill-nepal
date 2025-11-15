#!/bin/bash

# Open Skill Nepal - Backend Deployment Script

echo "🚀 Deploying Open Skill Nepal backend to Google Cloud Run..."

# Set variables
PROJECT_ID="open-skill-nepal"
SERVICE_NAME="open-skill-backend"
REGION="asia-south1"

# Build and deploy
echo "🏗️ Building and deploying backend..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)')
echo "✅ Backend deployed successfully!"
echo "🌐 Service URL: $SERVICE_URL"

# Update environment variables
echo "🔧 Update your frontend environment variables:"
echo "NEXT_PUBLIC_API_URL=$SERVICE_URL"
echo "NEXT_PUBLIC_WS_URL=wss://$(echo $SERVICE_URL | sed 's~https://~~')"
