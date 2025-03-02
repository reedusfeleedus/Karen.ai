#!/bin/bash

# Exit on error
set -e

# AWS Region - explicitly set
REGION="eu-west-2"

# Ubuntu 22.04 LTS AMI ID for eu-west-2 (London)
AMI_ID="ami-0eb260c4d5475b901"

# Instance configuration
INSTANCE_TYPE="t3.medium"
KEY_NAME="karen-ai-key"
SECURITY_GROUP_NAME="karen-ai-security-group"

echo "=== CONFIGURATION ==="
echo "Region: $REGION"
echo "AMI ID: $AMI_ID"
echo "Instance Type: $INSTANCE_TYPE"
echo "Key Name: $KEY_NAME"
echo "Security Group: $SECURITY_GROUP_NAME"
echo "===================="

# Create key pair if it doesn't exist
if ! aws ec2 describe-key-pairs --region $REGION --key-names $KEY_NAME >/dev/null 2>&1; then
    echo "Creating new key pair..."
    aws ec2 create-key-pair \
        --region $REGION \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
else
    echo "Using existing key pair: $KEY_NAME"
fi

# Get security group ID
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --region $REGION \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

if [ "$SECURITY_GROUP_ID" = "None" ] || [ -z "$SECURITY_GROUP_ID" ]; then
    echo "Error: Security group not found. Please create it first."
    exit 1
fi

echo "Using security group ID: $SECURITY_GROUP_ID"

# Launch EC2 instance with explicit region
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --region $REGION \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=karen-ai-automation}]" \
    --output text --query 'Instances[0].InstanceId')

if [ -z "$INSTANCE_ID" ]; then
    echo "Failed to launch instance"
    exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."
aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID

# Get instance public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --region $REGION \
    --instance-ids $INSTANCE_ID \
    --output text --query 'Reservations[0].Instances[0].PublicIpAddress')

if [ -z "$PUBLIC_IP" ]; then
    echo "Failed to get instance public IP"
    exit 1
fi

echo "Instance launched successfully!"
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Command: ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"

# Create a config file with instance details
cat > instance-config.json << EOF
{
    "instanceId": "$INSTANCE_ID",
    "publicIp": "$PUBLIC_IP",
    "keyName": "$KEY_NAME",
    "securityGroupId": "$SECURITY_GROUP_ID",
    "region": "$REGION"
}
EOF

echo "Configuration saved to instance-config.json"
echo ""
echo "Next steps:"
echo "1. Wait a few minutes for the instance to fully initialize"
echo "2. SSH into the instance using: ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo "3. Copy the infrastructure files and run setup-ec2.sh" 