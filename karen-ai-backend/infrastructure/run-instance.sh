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

# Get security group ID
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --region $REGION \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo "Using security group ID: $SECURITY_GROUP_ID"

# Launch EC2 instance with explicit region
echo "Launching EC2 instance with AMI: $AMI_ID in region $REGION..."
INSTANCE_ID=$(aws ec2 run-instances \
    --region $REGION \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=karen-ai-automation}]' \
    --output text --query 'Instances[0].InstanceId')

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."
aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID

# Get instance public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --region $REGION \
    --instance-ids $INSTANCE_ID \
    --output text --query 'Reservations[0].Instances[0].PublicIpAddress')

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