# Starlight Network Monitor

A local network monitoring tool with a game-like visualization interface. Monitor your network infrastructure in real-time using multiple monitoring methods including MQTT probes, ICMP ping, SNMP, and HTTP health checks. Designed to work **completely offline** on your local network.

![Starlight Logo](frontend/public/starlight.svg)

## Features

- **Visual Network Builder**: Drag-and-drop interface to create your network topology
- **Node Groups**: Organize nodes into visual grouping zones (departments, floors, areas)
- **Real-time Monitoring**: Live status updates via WebSocket connections
- **Multiple Monitoring Methods**: MQTT push, ICMP Ping, SNMP polling, HTTP health checks
- **Dual Status Tracking**: Monitor both local network connectivity AND internet connectivity separately
- **ISP Detection**: Automatic ISP detection with failover source switching
- **Game-like UI**: Cyberpunk-inspired interface with animations and visual effects
- **Offline-First**: Works entirely on your local network, no cloud dependencies
- **Modular Design**: Add as many nodes as you need to cover your network

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │◄──►│   Backend    │◄──►│  PostgreSQL  │       │
│  │  (React/Vite)│    │  (Node.js)   │    │              │       │
│  │   Port 8080  │    │   Port 4000  │    │   Port 5432  │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                    │
│                             ▼                                    │
│                      ┌──────────────┐                            │
│                      │  Mosquitto   │◄──── Probes (MQTT)         │
│                      │ MQTT Broker  │      (Arduino/ESP32)       │
│                      │   Port 1883  │                            │
│                      └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development only)

### One-Command Setup

```bash
# Clone and start everything with a single command
git clone https://github.com/your-org/codename-starlight.git
cd codename-starlight
./start.sh
```

That's it! The script will:
- Check Docker prerequisites
- Create `.env` with secure auto-generated credentials
- Build and start all services
- Wait for everything to be ready
- Display the access URL and admin password

**Access the application:**
- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:4000
- **MQTT Broker:** mqtt://localhost:1883

**To stop:**
```bash
./stop.sh
```

**To completely clean up (including data):**
```bash
./stop.sh --clean
```

### Manual Setup (Alternative)

If you prefer manual setup:

1. **Copy environment file**
   ```bash
   cp env.example .env
   # Edit .env to set AUTH_ADMIN_PASSWORD and AUTH_SESSION_SECRET
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application** at http://localhost:8080

### Local Development

1. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Setup database**
   ```bash
   # Start PostgreSQL and MQTT with Docker
   docker-compose up -d postgres mqtt-broker
   
   # Run migrations
   npm run db:push
   ```

3. **Start backend**
   ```bash
   npm run dev
   ```

4. **Install frontend dependencies** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Usage Guide

### Building Your Network

1. **Select Add Mode**: Click the "+" tool in the left toolbar
2. **Place Nodes**: Click anywhere on the canvas to add a new node
3. **Connect Nodes**: Switch to "Connect" mode and click two nodes to link them
4. **Configure Nodes**: Click on a node to edit its name, type, monitoring method, and color
5. **Create Groups**: Switch to "Group" mode to create visual grouping zones
6. **Assign to Groups**: Drag nodes into groups or use the node editor

### Node Types

| Type | Description | Default Monitoring |
|------|-------------|-------------------|
| PROBE | Physical probe device (Arduino, ESP32) | MQTT |
| ROUTER | Network router | PING |
| SWITCH | Network switch | PING |
| SERVER | Server or computer | PING |
| GATEWAY | Internet gateway | PING |
| ACCESS_POINT | Wireless access point | PING |
| FIREWALL | Network firewall | PING |
| VIRTUAL | Virtual/logical grouping node | None |
| INTERNET | External internet connection (ISP) | External DNS check |
| MAIN_LINK | Main network entry point | PING |

### Monitoring Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| MQTT | Push updates from device | Physical probes (ESP32, Arduino) |
| PING | ICMP ping polling | Routers, switches, servers |
| SNMP | SNMP v1/v2c/v3 polling | Managed network devices |
| HTTP | HTTP endpoint health check | Web servers, APIs |
| None | Visual-only (no monitoring) | Virtual nodes, groupings |

### Editor Modes

| Mode | Shortcut | Description |
|------|----------|-------------|
| Select | V | Select and drag nodes, pan canvas |
| Add | A | Add new nodes by clicking on canvas |
| Connect | C | Create connections between nodes |
| Delete | D | Remove nodes or connections |
| Group | G | Create grouping zones |
| Connect Groups | Shift+C | Create connections between groups |

### Canvas Controls

- **Zoom**: Use toolbar buttons or scroll wheel
- **Pan**: Drag on empty canvas space (in Select mode)
- **Reset View**: Click the maximize button to reset zoom and position

## Node Configuration

### Monitoring Configuration

Each node can be configured with different monitoring settings based on its type:

**For PING monitoring:**
- `ipAddress`: IP address to ping
- `pingInterval`: Seconds between checks (default: 30)

**For SNMP monitoring:**
- `ipAddress`: Device IP address
- `snmpCommunity`: SNMP community string (default: "public")
- `snmpVersion`: SNMP version - "1", "2c", or "3"

**For HTTP monitoring:**
- `ipAddress`: Server IP address
- `httpEndpoint`: Full URL or path (defaults to `http://{ip}/health`)
- `httpExpectedCode`: Expected HTTP status code (default: 200)

**For MQTT monitoring:**
- `mqttTopic`: MQTT topic to subscribe to (e.g., `network/probes/probe-001/status`)

### Internet Nodes (ISP Configuration)

For INTERNET type nodes, you can configure ISP detection:

- `ispName`: ISP name to match (e.g., "Comcast", "AT&T", "Verizon")
- `ispOrganization`: Alternative organization name to match

The system automatically detects the current ISP and can switch the active source when failover occurs.

## Node Groups

Groups allow you to visually organize nodes into zones representing:
- Physical locations (floors, rooms, buildings)
- Departments or teams
- Network segments (DMZ, internal, guest)

### Creating Groups

1. Switch to **Group** mode (G)
2. Click and drag on the canvas to create a zone
3. Configure the group name, color, and opacity
4. Drag nodes into the group or assign via node editor

### Connecting Groups

Create connections between groups to show inter-area links:
1. Switch to **Connect Groups** mode (Shift+C)
2. Click on source group, then target group
3. Optionally add labels and bandwidth information

## ISP Detection & Failover

Starlight can automatically detect your current ISP and visualize which internet connection is active:

1. **Configure INTERNET nodes** with `ispName` or `ispOrganization`
2. The backend queries ip-api.com to detect the current ISP
3. When detected, the matching INTERNET node's connection is marked as "active source"
4. Visual indicators show which ISP is currently providing connectivity

This is useful for:
- Dual-WAN setups with automatic failover
- Monitoring which ISP is currently active
- Tracking ISP changes over time

## Probe Configuration

### Arduino/ESP32 Probe Setup

For detailed probe setup instructions, see the [Probes README](probes/README.md).

Each probe should publish status messages to the MQTT broker. Here's an example for ESP32:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "192.168.1.100";  // Your Docker host IP
const char* node_id = "probe-kitchen";       // Unique probe ID

WiFiClient espClient;
PubSubClient client(espClient);

// Check internet connectivity
bool checkInternet() {
  WiFiClient testClient;
  return testClient.connect("8.8.8.8", 53);
}

void publishStatus() {
  bool networkOk = WiFi.status() == WL_CONNECTED;
  bool internetOk = checkInternet();
  
  // Status message
  String payload = "{";
  payload += "\"status\":\"" + String(networkOk ? "online" : "offline") + "\",";
  payload += "\"internetStatus\":\"" + String(internetOk ? "online" : "offline") + "\",";
  payload += "\"latency\":" + String(WiFi.RSSI());
  payload += "}";
  
  String topic = "network/probes/" + String(node_id) + "/status";
  client.publish(topic.c_str(), payload.c_str());
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    client.connect(node_id);
  }
  client.loop();
  
  publishStatus();
  delay(5000);  // Send status every 5 seconds
}
```

### MQTT Topic Structure

| Topic | Description |
|-------|-------------|
| `network/probes/{nodeId}/status` | Status updates (online/offline/degraded) |
| `network/probes/{nodeId}/heartbeat` | Lightweight heartbeat ping |
| `network/probes/{nodeId}/internet` | Internet connectivity status |
| `network/system/alerts` | System-wide alerts |

### Status Message Format

```json
{
  "status": "online",
  "internetStatus": "online",
  "latency": 23,
  "rssi": -45,
  "uptime": 3600,
  "ip": "192.168.1.50",
  "message": "Optional status message"
}
```

## API Reference

### Nodes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nodes` | List all nodes |
| GET | `/api/nodes/:id` | Get single node |
| POST | `/api/nodes` | Create new node |
| PUT | `/api/nodes/:id` | Update node |
| PATCH | `/api/nodes/:id/position` | Update node position |
| DELETE | `/api/nodes/:id` | Delete node |

### Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections` | List all connections |
| POST | `/api/connections` | Create connection |
| PUT | `/api/connections/:id` | Update connection |
| DELETE | `/api/connections/:id` | Delete connection |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups |
| GET | `/api/groups/:id` | Get single group with nodes |
| POST | `/api/groups` | Create new group |
| PUT | `/api/groups/:id` | Update group |
| PATCH | `/api/groups/:id/position` | Update group position/size |
| POST | `/api/groups/:id/assign-node` | Assign a node to group |
| POST | `/api/groups/:id/unassign-node` | Remove node from group |
| DELETE | `/api/groups/:id` | Delete group |

### Group Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/group-connections` | List all group connections |
| GET | `/api/group-connections/:id` | Get single group connection |
| POST | `/api/group-connections` | Create group connection |
| PUT | `/api/group-connections/:id` | Update group connection |
| DELETE | `/api/group-connections/:id` | Delete group connection |

### Network

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/network` | Get full network topology |
| GET | `/api/network/layouts` | List saved layouts |
| POST | `/api/network/layouts` | Save current layout |
| POST | `/api/network/layouts/:id/load` | Load a layout |

### Probes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/probes/status` | Current probe statuses |
| GET | `/api/probes/summary` | Status summary |
| GET | `/api/probes/:id/history` | Status history |
| GET | `/api/probes/outages` | Recent outages |

## Authentication

Starlight uses a simple admin password authentication system to protect your network monitoring dashboard.

### Default Setup

When you run `./start.sh`, a secure random password is automatically generated and stored in the `.env` file. The password is displayed at the end of the setup process.

### Changing the Password

1. Edit the `.env` file
2. Update `AUTH_ADMIN_PASSWORD` to your desired password
3. Restart the services: `./stop.sh && ./start.sh`

### Security Notes

- The admin password protects all API endpoints and the web interface
- Tokens are generated using HMAC-SHA256 with a session secret
- Tokens are stored in the browser's localStorage
- For production use, always set a strong `AUTH_ADMIN_PASSWORD` and `AUTH_SESSION_SECRET`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Backend server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `MQTT_BROKER_URL` | mqtt://localhost:1883 | MQTT broker URL |
| `PROBE_TIMEOUT` | 30000 | Timeout to mark probe offline (ms) |
| `AUTH_ADMIN_PASSWORD` | changeme | Admin password for login |
| `AUTH_SESSION_SECRET` | - | Secret for token generation |
| `VITE_API_URL` | - | Backend API URL for frontend |
| `VITE_WS_URL` | - | WebSocket URL for frontend |

## Troubleshooting

### Probes not showing status updates

1. Check MQTT broker is running: `docker-compose logs mqtt-broker`
2. Verify probe is publishing to correct topic
3. Ensure MQTT topic in node config matches probe topic

### Nodes showing as UNKNOWN

1. Verify monitoring method is configured correctly
2. For PING/SNMP/HTTP: ensure IP address is set
3. Check if the node is reachable from the backend container

### WebSocket connection failing

1. Verify backend is running on port 4000
2. Check browser console for connection errors
3. Ensure firewall allows WebSocket connections

### Database connection issues

1. Check PostgreSQL container is healthy: `docker-compose ps`
2. Verify DATABASE_URL in .env file
3. Run migrations: `cd backend && npm run db:push`

### ISP detection not working

1. Ensure backend can reach ip-api.com (internet access required)
2. Verify INTERNET nodes have `ispName` or `ispOrganization` configured
3. Check backend logs for ISP detection messages

## Technology Stack

**Frontend**
- React 18 with TypeScript
- Konva.js for canvas visualization
- Zustand for state management
- TailwindCSS for styling
- Lucide React for icons

**Backend**
- Node.js with Express
- Prisma ORM
- MQTT.js for broker communication
- WebSocket (ws) for real-time updates
- ping for ICMP monitoring
- net-snmp for SNMP polling

**Infrastructure**
- PostgreSQL database
- Mosquitto MQTT broker
- Docker & Docker Compose

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with care for reliable network monitoring
