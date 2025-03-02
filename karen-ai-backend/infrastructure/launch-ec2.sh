#!/bin/bash

# AWS Region
REGION="us-east-1"

# Ubuntu 22.04 LTS AMI ID for us-east-1
AMI_ID="ami-0c7217cdde317cfec"

# Instance configuration
INSTANCE_TYPE="t3.medium"
KEY_NAME="karen-ai-key"  # You'll need to create this key pair in AWS first
SECURITY_GROUP_NAME="karen-ai-security-group"

# Create security group
echo "Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name $SECURITY_GROUP_NAME \
    --description "Security group for Karen AI browser automation" \
    --output text --query 'GroupId')

# Add security group rules
echo "Configuring security group rules..."
aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 3001 \
    --cidr 0.0.0.0/0

# Create key pair if it doesn't exist
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME >/dev/null 2>&1; then
    echo "Creating new key pair..."
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --query 'KeyMaterial' \
        --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
fi

# Launch EC2 instance
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings "[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=karen-ai-automation}]" \
    --output text --query 'Instances[0].InstanceId')

echo "Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get instance public IP
PUBLIC_IP=$(aws ec2 describe-instances \
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
echo ""
echo "Next steps:"
echo "1. Wait a few minutes for the instance to fully initialize"
echo "2. SSH into the instance using: ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo "3. Copy the infrastructure files and run setup-ec2.sh" 