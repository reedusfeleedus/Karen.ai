#!/bin/bash

# Exit on error
set -e

# AWS Region - explicitly set
REGION="eu-west-2"
SECURITY_GROUP_NAME="karen-ai-security-group"

echo "Creating security group in region $REGION..."

# Check if security group exists
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
    --region $REGION \
    --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

if [ "$SECURITY_GROUP_ID" = "None" ] || [ -z "$SECURITY_GROUP_ID" ]; then
    echo "Creating new security group..."
    SECURITY_GROUP_ID=$(aws ec2 create-security-group \
        --region $REGION \
        --group-name $SECURITY_GROUP_NAME \
        --description "Security group for Karen AI browser automation" \
        --output text --query 'GroupId')
    
    echo "Security group created: $SECURITY_GROUP_ID"
    
    echo "Configuring security group rules..."
    aws ec2 authorize-security-group-ingress \
        --region $REGION \
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
    
    echo "Security group rules configured successfully."
else
    echo "Using existing security group: $SECURITY_GROUP_ID"
fi

echo "Security group ID: $SECURITY_GROUP_ID" 