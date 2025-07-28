#!/bin/bash

# Deploy HEMS Emulator with SQLite on Compute Engine
set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"zerofy-energy-dev"}
ZONE=${ZONE:-"europe-west1-b"}
INSTANCE_NAME="hems-emulator-sqlite"
DISK_NAME="hems-data-disk"

echo "🚀 Deploying HEMS Emulator with SQLite on Compute Engine"
echo "================================================"

# Create persistent disk for SQLite database
echo "💾 Creating persistent disk for database..."
gcloud compute disks create $DISK_NAME \
  --size=10GB \
  --zone=$ZONE \
  --type=pd-standard \
  --project=$PROJECT_ID || echo "Disk already exists"

# Create VM instance
echo "🖥️ Creating Compute Engine instance..."
gcloud compute instances create $INSTANCE_NAME \
  --zone=$ZONE \
  --machine-type=e2-standard-2 \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=20GB \
  --disk=name=$DISK_NAME,device-name=data-disk,mode=rw,auto-delete=no \
  --tags=http-server,https-server \
  --metadata=startup-script='#!/bin/bash
    # Mount persistent disk
    sudo mkdir -p /mnt/data
    sudo mount /dev/disk/by-id/google-data-disk /mnt/data || {
      sudo mkfs.ext4 -F /dev/disk/by-id/google-data-disk
      sudo mount /dev/disk/by-id/google-data-disk /mnt/data
    }
    
    # Set up docker-compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Clone repository and start services
    cd /home
    git clone https://github.com/your-org/device-emulator.git || true
    cd device-emulator
    
    # Create docker-compose override for persistent storage
    cat > docker-compose.override.yml << EOF
version: "3.8"
services:
  database:
    image: postgres:15
    volumes:
      - /mnt/data/postgres:/var/lib/postgresql/data
    restart: unless-stopped
    
  backend:
    environment:
      - DATABASE_URL=postgresql://hems_user:hems_secure_password@database:5432/hems_emulator
    restart: unless-stopped
    
  # Alternative: Use SQLite with persistent storage
  # backend:
  #   environment:
  #     - DATABASE_URL=sqlite:///mnt/data/hems.db
  #   volumes:
  #     - /mnt/data:/mnt/data
  #   restart: unless-stopped
EOF
    
    # Start services
    docker-compose up -d
  ' \
  --project=$PROJECT_ID

# Create firewall rules
echo "🔥 Setting up firewall rules..."
gcloud compute firewall-rules create allow-hems-http \
  --allow tcp:3000,tcp:8080 \
  --source-ranges 0.0.0.0/0 \
  --target-tags http-server \
  --project=$PROJECT_ID || echo "Firewall rule already exists"

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='value(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "✅ Deployment complete!"
echo "External IP: $EXTERNAL_IP"
echo "Frontend URL: http://$EXTERNAL_IP:3000"
echo "Backend URL: http://$EXTERNAL_IP:8080"
echo ""
echo "SSH into instance: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo "View logs: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='cd device-emulator && docker-compose logs -f'" 