#!/bin/bash

# ===========================================
# Starlight Network Monitor - Quick Start Script
# ===========================================
# This script sets up and starts all services with a single command

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║   🌟 Starlight Network Monitor                    ║"
echo "║      Quick Start Setup                            ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to generate a random string for session secret
generate_random_string() {
    if command_exists openssl; then
        openssl rand -hex 32
    elif [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    else
        # Fallback: use date and process info
        echo "$(date +%s%N)$$" | sha256sum | cut -d' ' -f1
    fi
}

# Check for Docker
echo -e "${BLUE}[1/5]${NC} Checking prerequisites..."

if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker found"

# Check for Docker Compose (v2 integrated or standalone)
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    echo -e "  ${GREEN}✓${NC} Docker Compose (v2) found"
elif command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
    echo -e "  ${GREEN}✓${NC} Docker Compose (standalone) found"
else
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker daemon is not running.${NC}"
    echo "Please start Docker and try again."
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker daemon is running"

# Setup environment file
echo -e "\n${BLUE}[2/5]${NC} Setting up environment..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_CREATED=false
ADMIN_PASSWORD=""

if [ ! -f .env ]; then
    if [ -f env.example ]; then
        cp env.example .env
        ENV_CREATED=true
        echo -e "  ${GREEN}✓${NC} Created .env from env.example"
        
        # Prompt user to create admin password
        echo ""
        echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║         First-Time Setup: Create Password         ║${NC}"
        echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
        echo ""
        
        while true; do
            echo -ne "${YELLOW}Enter admin password: ${NC}"
            read -s ADMIN_PASSWORD
            echo ""
            
            if [ -z "$ADMIN_PASSWORD" ]; then
                echo -e "${RED}Password cannot be empty. Please try again.${NC}"
                continue
            fi
            
            if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
                echo -e "${RED}Password must be at least 6 characters. Please try again.${NC}"
                continue
            fi
            
            echo -ne "${YELLOW}Confirm admin password: ${NC}"
            read -s CONFIRM_PASSWORD
            echo ""
            
            if [ "$ADMIN_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
                echo -e "${RED}Passwords do not match. Please try again.${NC}"
                continue
            fi
            
            break
        done
        
        echo -e "  ${GREEN}✓${NC} Admin password set"
        
        # Generate secure session secret
        SESSION_SECRET=$(generate_random_string)
        
        # Update .env with values
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/AUTH_ADMIN_PASSWORD=changeme/AUTH_ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env
            sed -i '' "s/AUTH_SESSION_SECRET=.*/AUTH_SESSION_SECRET=$SESSION_SECRET/" .env
        else
            # Linux
            sed -i "s/AUTH_ADMIN_PASSWORD=changeme/AUTH_ADMIN_PASSWORD=$ADMIN_PASSWORD/" .env
            sed -i "s/AUTH_SESSION_SECRET=.*/AUTH_SESSION_SECRET=$SESSION_SECRET/" .env
        fi
        echo -e "  ${GREEN}✓${NC} Environment configured"
    else
        echo -e "${RED}Error: env.example not found.${NC}"
        exit 1
    fi
else
    echo -e "  ${YELLOW}!${NC} Using existing .env file"
    # Don't display the password for existing setups
    ADMIN_PASSWORD=""
fi

# Build and start containers
echo -e "\n${BLUE}[3/5]${NC} Building and starting containers..."
echo -e "  ${YELLOW}This may take a few minutes on first run...${NC}"

$COMPOSE_CMD up --build -d

# Wait for services to be healthy
echo -e "\n${BLUE}[4/5]${NC} Waiting for services to be ready..."

# Wait for PostgreSQL
echo -n "  Waiting for PostgreSQL..."
RETRIES=30
until docker exec $(docker ps -qf "name=postgres") pg_isready -U starlight -d starlight_db >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    RETRIES=$((RETRIES-1))
    sleep 2
done
if [ $RETRIES -eq 0 ]; then
    echo -e " ${RED}Failed${NC}"
    echo "PostgreSQL did not become ready in time."
    exit 1
fi
echo -e " ${GREEN}Ready${NC}"

# Wait for backend
echo -n "  Waiting for Backend API..."
RETRIES=30
until curl -s http://localhost:4000/health >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    RETRIES=$((RETRIES-1))
    sleep 2
done
if [ $RETRIES -eq 0 ]; then
    echo -e " ${RED}Failed${NC}"
    echo "Backend did not become ready in time."
    exit 1
fi
echo -e " ${GREEN}Ready${NC}"

# Wait for frontend
echo -n "  Waiting for Frontend..."
RETRIES=30
until curl -s http://localhost:8080 >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo -n "."
    RETRIES=$((RETRIES-1))
    sleep 2
done
if [ $RETRIES -eq 0 ]; then
    echo -e " ${RED}Failed${NC}"
    echo "Frontend did not become ready in time."
    exit 1
fi
echo -e " ${GREEN}Ready${NC}"

# Print success message
echo -e "\n${BLUE}[5/5]${NC} Setup complete!"

echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║   🌟 Starlight is now running!                    ║"
echo "║                                                   ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║                                                   ║"
echo "║   Frontend:    http://localhost:8080              ║"
echo "║   Backend API: http://localhost:4000              ║"
echo "║   MQTT Broker: mqtt://localhost:1883              ║"
echo "║                                                   ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║                                                   ║"
echo "║   To stop: ./stop.sh                              ║"
echo "║   Logs:    docker compose logs -f                 ║"
echo "║                                                   ║"
if [ "$ENV_CREATED" = true ]; then
echo "╠═══════════════════════════════════════════════════╣"
echo "║                                                   ║"
echo "║   Login with the admin password you just created  ║"
echo "║                                                   ║"
fi
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
