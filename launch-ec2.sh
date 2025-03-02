#!/bin/bash

# Exit on error
set -e

# AWS Region
REGION="eu-west-2"

# Ubuntu 22.04 LTS AMI ID for eu-west-2 (London)
AMI_ID="ami-0eb260c4d5475b901"  # Ubuntu 22.04 LTS in eu-west-2

# Instance configuration
INSTANCE_TYPE="t3.medium"
KEY_NAME="karen-ai-key"
SECURITY_GROUP_NAME="karen-ai-security-group"

# Check if security group exists
echo "Checking for existing security group..."
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

if [ "$SECURITY_GROUP_ID" = "None" ] || [ -z "$SECURITY_GROUP_ID" ]; then
    echo "Creating new security group..."
    SECURITY_GROUP_ID=$(aws ec2 create-security-group \
        --group-name $SECURITY_GROUP_NAME \
        --description "Security group for Karen AI browser automation" \
        --output text --query 'GroupId')
    
    if [ -z "$SECURITY_GROUP_ID" ]; then
        echo "Failed to create security group"
        exit 1
    fi
    
    echo "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress \
        --group-id $SECURITY_GROUP_ID \
        --ip-permissions '[
            {
                "IpProtocol": "tcp",
                "FromPort": 22,
                "ToPort": 22,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
            },
            {
                "IpProtocol": "tcp",
                "FromPort": 80,
                "ToPort": 80,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
            },
            {
                "IpProtocol": "tcp",
                "FromPort": 443,
                "ToPort": 443,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
            },
            {
                "IpProtocol": "tcp",
                "FromPort": 3001,
                "ToPort": 3001,
                "IpRanges": [{"CidrIp": "0.0.0.0/0"}]
            }
        ]'
else
    echo "Using existing security group: $SECURITY_GROUP_ID"
fi

# Create key pair if it doesn't exist
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME >/dev/null 2>&1; then
    echo "Creating new key pair..."
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
else
    echo "Using existing key pair: $KEY_NAME"
fi

# Launch EC2 instance
echo "Launching EC2 instance with AMI: $AMI_ID..."
INSTANCE_ID=$(aws ec2 run-instances \
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
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get instance public IP
PUBLIC_IP=$(aws ec2 describe-instances \
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