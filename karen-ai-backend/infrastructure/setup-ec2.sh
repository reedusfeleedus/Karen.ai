#!/bin/bash

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create directory structure
mkdir -p ~/karen-ai/infrastructure/{nginx,scripts,certbot/{conf,www}}

# Clone the repository
git clone https://github.com/reedusfeleedus/Karen.ai.git ~/karen-ai-repo

# Copy infrastructure files
cp -r ~/karen-ai-repo/karen-ai-backend/infrastructure/* ~/karen-ai/infrastructure/

# Start Docker services
cd ~/karen-ai/infrastructure
sudo docker-compose up -d

# Print success message
echo "Setup completed! Docker containers are now running."
echo "You can check the status with: docker ps" 