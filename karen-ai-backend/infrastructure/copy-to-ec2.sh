#!/bin/bash

# Load instance configuration
if [ ! -f instance-config.json ]; then
    echo "Error: instance-config.json not found"
    exit 1
fi

PUBLIC_IP=$(cat instance-config.json | jq -r '.publicIp')
KEY_NAME=$(cat instance-config.json | jq -r '.keyName')

if [ -z "$PUBLIC_IP" ] || [ -z "$KEY_NAME" ]; then
    echo "Error: Could not read instance configuration"
    exit 1
fi

echo "Creating remote directories..."
ssh -i "${KEY_NAME}.pem" -o StrictHostKeyChecking=no ubuntu@$PUBLIC_IP "mkdir -p ~/karen-ai/infrastructure/{nginx,scripts,certbot/{conf,www}}"

echo "Copying infrastructure files..."
scp -i "${KEY_NAME}.pem" \
    docker-compose.yml \
    setup-ec2.sh \
    nginx/default.conf \
    scripts/test-automation.js \
    ubuntu@$PUBLIC_IP:~/karen-ai/infrastructure/

echo "Setting up permissions..."
ssh -i "${KEY_NAME}.pem" ubuntu@$PUBLIC_IP "chmod +x ~/karen-ai/infrastructure/setup-ec2.sh"

echo "Files copied successfully!"
echo "To complete setup:"
echo "1. SSH into the instance: ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo "2. Run: cd ~/karen-ai/infrastructure && ./setup-ec2.sh" 