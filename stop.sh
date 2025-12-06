#!/bin/bash

# ===========================================
# Starlight Network Monitor - Stop Script
# ===========================================
# This script gracefully stops all services

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
echo "║      Shutting Down...                             ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Determine compose command
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    exit 1
fi

# Check for flags
REMOVE_VOLUMES=false
REMOVE_IMAGES=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -v|--volumes) REMOVE_VOLUMES=true ;;
        -i|--images) REMOVE_IMAGES=true ;;
        --clean) REMOVE_VOLUMES=true; REMOVE_IMAGES=true ;;
        -h|--help)
            echo "Usage: ./stop.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --volumes   Remove data volumes (database, mqtt data)"
            echo "  -i, --images    Remove built images"
            echo "  --clean         Remove both volumes and images (full cleanup)"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
    shift
done

# Stop containers
echo -e "${BLUE}[1/2]${NC} Stopping containers..."
$COMPOSE_CMD down

if [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${BLUE}[Extra]${NC} Removing data volumes..."
    $COMPOSE_CMD down -v
    echo -e "  ${GREEN}✓${NC} Volumes removed"
fi

if [ "$REMOVE_IMAGES" = true ]; then
    echo -e "${BLUE}[Extra]${NC} Removing built images..."
    docker rmi starlight-frontend starlight-backend 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} Images removed"
fi

echo -e "\n${BLUE}[2/2]${NC} Shutdown complete!"

echo -e "\n${GREEN}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║   🌟 Starlight has been stopped                   ║"
echo "║                                                   ║"
echo "║   To restart: ./start.sh                          ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
