# Karen AI Infrastructure Setup

This directory contains the infrastructure setup for Karen AI's browser automation service.

## AWS EC2 Setup

1. Launch a t3.medium EC2 instance:
   - AMI: Ubuntu Server 22.04 LTS
   - Instance Type: t3.medium
   - Storage: 30GB gp3
   - Security Group: Use security-group.json configuration

2. Connect to your instance:
```bash
ssh -i your-key.pem ubuntu@your-instance-ip
```

3. Run the setup script:
```bash
# Make the script executable
chmod +x setup-ec2.sh
# Run the script
./setup-ec2.sh
```

## Directory Structure
```
infrastructure/
├── docker-compose.yml    # Docker services configuration
├── nginx/               # Nginx configuration
├── scripts/            # Browser automation scripts
├── certbot/            # SSL certificate data
└── setup-ec2.sh       # EC2 setup script
```

## Security Group Configuration
- Port 22: SSH access
- Port 80: HTTP
- Port 443: HTTPS
- Port 3001: Playwright service

## Testing the Setup

1. Check if containers are running:
```bash
docker ps
```

2. Test browser automation:
```bash
docker exec karen-playwright node /app/scripts/test-automation.js
```

3. Check the logs:
```bash
docker logs karen-playwright
```

## Maintenance

- Monitor disk usage: `df -h`
- Check Docker logs: `docker logs karen-playwright`
- Restart services: `docker-compose restart`
- Update containers: `docker-compose pull && docker-compose up -d`

## Security Notes

- The security group configuration allows access from all IPs (0.0.0.0/0)
- Consider restricting IP ranges in production
- Keep the instance updated: `sudo apt update && sudo apt upgrade`
- Monitor AWS CloudWatch logs and metrics 