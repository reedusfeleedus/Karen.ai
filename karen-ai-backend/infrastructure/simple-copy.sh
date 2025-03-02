#!/bin/bash
PUBLIC_IP="35.178.194.114"
KEY_NAME="karen-ai-key"
echo "Creating remote directories..."
ssh -i "${KEY_NAME}.pem" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP "mkdir -p ~/karen-ai/infrastructure/{nginx,scripts,certbot/{conf,www}}"
echo "Copying infrastructure files..."
scp -i "${KEY_NAME}.pem" docker-compose.yml setup-ec2.sh nginx/default.conf scripts/test-automation.js ubuntu@$PUBLIC_IP:~/karen-ai/infrastructure/
echo "Setting up permissions..."
ssh -i "${KEY_NAME}.pem" ubuntu@$PUBLIC_IP "chmod +x ~/karen-ai/infrastructure/setup-ec2.sh"
