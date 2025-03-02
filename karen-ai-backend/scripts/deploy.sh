#!/bin/bash

# Exit on any error
set -e

echo "Starting Karen.ai backend deployment"

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install necessary dependencies
echo "Installing dependencies..."
sudo apt-get install -y git build-essential

# Install AWS CLI
if ! command -v aws &> /dev/null; then
  echo "Installing AWS CLI..."
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip awscliv2.zip
  sudo ./aws/install
  rm -rf aws awscliv2.zip
fi

# Clone or update the repository
if [ -d "karen-ai-backend" ]; then
  echo "Updating existing repository..."
  cd karen-ai-backend
  git pull
else
  echo "Cloning repository..."
  git clone https://github.com/your-username/karen-ai-backend.git
  cd karen-ai-backend
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Set up DocumentDB SSL certificate
echo "Setting up DocumentDB SSL certificate..."
node scripts/setup-docdb.js

# Set environment variables if not already set
if [ ! -f .env ]; then
  echo "Creating .env file from template..."
  cp .env.example .env
  
  # Prompt user to fill in the required environment variables
  echo "Please update the .env file with your AWS credentials and DocumentDB connection string."
  echo "Press any key to continue when done..."
  read -n 1
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi

# Start the application with PM2
echo "Starting the application with PM2..."
pm2 stop karen-ai-backend || true
pm2 start src/server.js --name karen-ai-backend

# Save PM2 process list
pm2 save

# Set up PM2 to start on system boot
echo "Setting up PM2 to start on system boot..."
pm2 startup | tail -n 1 | bash

echo "Deployment completed successfully!"
echo "The application is now running at http://localhost:3000" 