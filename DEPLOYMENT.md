# HEMS Emulator - Google Cloud Deployment Guide

This guide covers deploying the HEMS Device Emulator to Google Cloud using Cloud Run.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Cloud Run     │    │   Cloud Run     │
│   Frontend      │    │   Backend       │
│   (React/Nginx) │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘
                               │
                       ┌───────▼────────┐
                       │   Cloud SQL    │
                       │  (PostgreSQL)  │
                       │   OR SQLite    │
                       └────────────────┘
```

## 🚀 Deployment Options

### Option 1: Quick Deploy (Recommended)

Use the automated deployment script:

```bash
# 1. Clone the repository
git clone <your-repo>
cd device-emulator

# 2. Set your Google Cloud project
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 3. Run deployment script
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Cloud Run Deployment

#### Prerequisites

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install Docker
# Follow: https://docs.docker.com/get-docker/

# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### Step-by-Step Deployment

```bash
# 1. Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# 2. Build and push backend
docker build -t gcr.io/YOUR_PROJECT_ID/hems-backend ./backend
docker push gcr.io/YOUR_PROJECT_ID/hems-backend

# 3. Build and push frontend
docker build -f ./frontend/Dockerfile.prod \
  --build-arg VITE_API_URL=https://YOUR_BACKEND_URL \
  --build-arg VITE_WS_URL=wss://YOUR_BACKEND_URL \
  -t gcr.io/YOUR_PROJECT_ID/hems-frontend ./frontend
docker push gcr.io/YOUR_PROJECT_ID/hems-frontend

# 4. Deploy backend
gcloud run deploy hems-backend \
  --image gcr.io/YOUR_PROJECT_ID/hems-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars NODE_ENV=production,JWT_SECRET=your-secure-secret

# 5. Deploy frontend
gcloud run deploy hems-frontend \
  --image gcr.io/YOUR_PROJECT_ID/hems-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi
```

### Option 3: Using docker-compose on Compute Engine

For a traditional VM-based deployment:

```bash
# 1. Create Compute Engine instance
gcloud compute instances create hems-emulator \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --zone=us-central1-a \
  --machine-type=e2-standard-2 \
  --boot-disk-size=20GB

# 2. SSH into instance
gcloud compute ssh hems-emulator --zone=us-central1-a

# 3. Install docker-compose and deploy
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

git clone <your-repo>
cd device-emulator
docker-compose -f docker-compose.prod.yml up -d
```

## 🗄️ Database Options

### Option A: SQLite (Simplest)
- Built-in with the application
- No additional setup required
- Data persists in container volume
- Perfect for development/testing

### Option B: Cloud SQL PostgreSQL
```bash
# Create Cloud SQL instance
gcloud sql instances create hems-db \
  --database-version=POSTGRES_14 \
  --cpu=1 \
  --memory=3840MB \
  --region=us-central1

# Create database
gcloud sql databases create hems_emulator --instance=hems-db

# Create user
gcloud sql users create hems_user --instance=hems-db --password=secure_password

# Get connection string for Cloud Run
DATABASE_URL="postgresql://hems_user:secure_password@/hems_emulator?host=/cloudsql/PROJECT_ID:us-central1:hems-db"
```

### Option C: Containerized PostgreSQL
Use the included `docker-compose.prod.yml` which includes PostgreSQL.

## 🔐 Environment Variables

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|-----------|
| `NODE_ENV` | Environment | `development` | No |
| `PORT` | Server port | `3001` | No |
| `DATABASE_URL` | Database connection | SQLite | No |
| `JWT_SECRET` | JWT signing secret | Generated | **Yes** |
| `CORS_ORIGIN` | Frontend URL | `*` | No |

### Frontend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://backend-xyz.run.app` |
| `VITE_WS_URL` | WebSocket URL | `wss://backend-xyz.run.app` |

## 📊 Monitoring & Logging

### Cloud Run Logs
```bash
# View backend logs
gcloud logs read --service=hems-backend --limit=50

# View frontend logs
gcloud logs read --service=hems-frontend --limit=50

# Follow logs in real-time
gcloud logs tail --service=hems-backend
```

### Health Checks
- Backend: `https://your-backend-url/health`
- Frontend: `https://your-frontend-url/health`

## 💰 Cost Estimation

### Cloud Run Pricing (us-central1)
- **Backend**: ~$5-15/month for light usage
  - 1 CPU, 1GB RAM
  - 100 requests/day average
- **Frontend**: ~$2-5/month
  - 0.5 CPU, 512MB RAM
  - Static serving

### Cost Optimization Tips
1. Use **minimum instances = 0** for development
2. Set **maximum instances = 5** to prevent runaway costs
3. Use **SQLite** instead of Cloud SQL for testing
4. Enable **CPU throttling** when not serving requests

## 🔧 Scaling Configuration

### Auto-scaling Settings
```yaml
# Cloud Run service configuration
annotations:
  run.googleapis.com/cpu-throttling: 'true'
  run.googleapis.com/memory: '1Gi'
  run.googleapis.com/cpu: '1'
  run.googleapis.com/max-instances: '10'
  run.googleapis.com/min-instances: '0'
```

### Performance Tuning
- **Backend**: 1-2 CPU, 1-2GB RAM
- **Frontend**: 0.5 CPU, 512MB RAM
- **Concurrency**: 100 requests per instance
- **Timeout**: 300 seconds (5 minutes)

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   gcloud builds log [BUILD_ID]
   ```

2. **Service Not Starting**
   ```bash
   # Check service logs
   gcloud logs read --service=hems-backend --limit=20
   ```

3. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL format
   echo $DATABASE_URL
   ```

4. **CORS Issues**
   ```bash
   # Check CORS_ORIGIN environment variable
   gcloud run services describe hems-backend --format="export"
   ```

### Debug Commands
```bash
# Service status
gcloud run services list

# Service details
gcloud run services describe hems-backend

# Update environment variables
gcloud run services update hems-backend \
  --set-env-vars JWT_SECRET=new-secret

# Scale to zero (save costs)
gcloud run services update hems-backend \
  --min-instances=0
```

## 🔄 CI/CD with Cloud Build

The included `cloudbuild.yaml` provides automatic deployment:

1. **Connect repository** to Cloud Build
2. **Create trigger** for main branch
3. **Set substitution variables**:
   - `_JWT_SECRET`: Your JWT secret
   - `_DATABASE_URL`: Database connection string

## 🌐 Custom Domains

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service hems-frontend \
  --domain your-domain.com \
  --region us-central1
```

## 📝 Next Steps

1. **Configure monitoring** with Cloud Operations
2. **Set up alerting** for service health
3. **Implement backup strategy** for data
4. **Configure SSL certificates** for custom domains
5. **Set up staging environment** for testing

---

**Need help?** Check the logs, review environment variables, and ensure all services are running. The HEMS emulator should be accessible via the Cloud Run URLs! 🏠⚡ 