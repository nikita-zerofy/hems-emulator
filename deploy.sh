#!/bin/bash

# HEMS Emulator Deployment Script for Google Cloud Run
set -e

# Configuration
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"zerofy-energy-dev"}
REGION=${REGION:-"europe-west1"}
SERVICE_NAME="hems-emulator"
DATABASE_TYPE=${DATABASE_TYPE:-"sqlite"}  # sqlite or postgres

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 HEMS Emulator - Google Cloud Run Deployment${NC}"
echo "================================================"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}🔧 Setting up Google Cloud project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔌 Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push images
echo -e "${YELLOW}🏗️  Building Docker images...${NC}"

# Backend
echo -e "${BLUE}Building backend image...${NC}"
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME-backend:latest ./backend
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME-backend:latest

# Frontend
echo -e "${BLUE}Building frontend image...${NC}"
docker build -f ./frontend/Dockerfile.prod \
  --build-arg VITE_API_URL=https://$SERVICE_NAME-backend-$RANDOM-uc.a.run.app \
  --build-arg VITE_WS_URL=wss://$SERVICE_NAME-backend-$RANDOM-uc.a.run.app \
  -t gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend:latest ./frontend
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend:latest

# Deploy backend
echo -e "${YELLOW}🚀 Deploying backend to Cloud Run...${NC}"

# Set database configuration based on type
if [ "$DATABASE_TYPE" = "sqlite" ]; then
  DATABASE_CONFIG="DATABASE_URL=sqlite:///app/data/hems.db,SQLITE_DB_PATH=/app/data/hems.db"
  echo -e "${BLUE}Using SQLite database (ephemeral)${NC}"
else
  DATABASE_CONFIG="DATABASE_URL=postgresql://user:pass@host:5432/hems"
  echo -e "${BLUE}Using PostgreSQL database${NC}"
fi

gcloud run deploy $SERVICE_NAME-backend \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME-backend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production,JWT_SECRET=your-jwt-secret-change-me,$DATABASE_CONFIG

# Get backend URL
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME-backend --platform managed --region $REGION --format 'value(status.url)')
echo -e "${GREEN}✅ Backend deployed at: $BACKEND_URL${NC}"

# Deploy frontend
echo -e "${YELLOW}🚀 Deploying frontend to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME-frontend \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME-frontend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 0.5 \
  --max-instances 5

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME-frontend --platform managed --region $REGION --format 'value(status.url)')
echo -e "${GREEN}✅ Frontend deployed at: $FRONTEND_URL${NC}"

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================"
echo -e "${BLUE}Frontend URL:${NC} $FRONTEND_URL"
echo -e "${BLUE}Backend URL:${NC} $BACKEND_URL"
echo -e "${BLUE}Zerofy API:${NC} $BACKEND_URL/api/zerofy"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Visit the frontend URL to access the HEMS emulator"
echo "2. Create a user account and start adding dwellings/devices"
echo "3. Use the Zerofy API endpoint for external integrations"
echo "4. Check Cloud Run logs: gcloud logs read --service=$SERVICE_NAME-backend"
echo ""
echo -e "${GREEN}Happy emulating! 🏠⚡${NC}" 