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
- **Web-Based Setup**: Configure everything through the browser - no command line required
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

### One-Command Install

Copy and paste this command to download and start Starlight:

```bash
curl -L https://github.com/Spottie97/codename-starlight/archive/refs/heads/main.tar.gz | tar xz && cd codename-starlight-main && docker compose up -d
```

That's it! The application will start and guide you through the initial setup.

### Alternative: Clone with Git

```bash
git clone https://github.com/Spottie97/codename-starlight.git
cd codename-starlight
docker compose up -d
```

**First-time Setup:**
1. Open http://localhost:8080 in your browser
2. You'll see the setup wizard - create your admin password
3. Log in with your new password
4. Start building your network topology!

**Access Points:**
- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:4000
- **MQTT Broker:** mqtt://localhost:1883

**Using a Different Port (if 8080 is already in use):**
```bash
STARLIGHT_PORT=3000 docker compose up -d
```
Then access the UI at `http://localhost:3000`

**To stop:**
```bash
docker compose down
```

**To completely clean up (including data):**
```bash
docker compose down -v
```

### Port Configuration

If you have port conflicts, you can customize the ports using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `STARLIGHT_PORT` | 8080 | Web UI port |
| `STARLIGHT_API_PORT` | 4000 | Backend API port |
| `STARLIGHT_MQTT_PORT` | 1883 | MQTT broker port |
| `STARLIGHT_DB_PORT` | 5432 | PostgreSQL port |

Example with custom ports:
```bash
STARLIGHT_PORT=3000 STARLIGHT_MQTT_PORT=1884 docker compose up -d
```

### Application Settings

All application settings are managed through the **Settings** page in the web UI (click the gear icon):

| Setting | Description |
|---------|-------------|
| **Admin Password** | Change your login password |
| **n8n Webhook URL** | Webhook endpoint for notifications |
| **n8n Webhook Secret** | HMAC secret for webhook signing |
| **Probe Timeout** | Time before marking a probe offline |
| **History Retention** | How long to keep status history |
| **Internet Check Targets** | IPs used for internet connectivity checks |

### Advanced Setup (Optional)

For advanced users who want to customize infrastructure settings:

1. **Custom database credentials** - Edit `docker-compose.yml` to change PostgreSQL settings
2. **External MQTT broker** - Update `MQTT_BROKER_URL` in `docker-compose.yml`
3. **Production deployment** - See the Production section below

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

## Webhook Integration (n8n)

Starlight can push network events to n8n (or any webhook endpoint) for notifications like WhatsApp alerts.

### Setup

1. Open **Settings** in the Starlight dashboard
2. Go to the **Webhooks** tab
3. Enter your n8n webhook URL
4. Optionally add a secret for HMAC signing
5. Click **Test** to verify connectivity

### Supported Events

| Event | Description |
|-------|-------------|
| NODE_DOWN | A monitored node goes offline |
| NODE_UP | A monitored node comes back online |
| INTERNET_DOWN | Internet connectivity is lost |
| INTERNET_UP | Internet connectivity is restored |
| ISP_CHANGED | Active ISP connection switched |
| GROUP_DEGRADED | 50%+ nodes in a group go offline |

### Webhook Payload Example

```json
{
  "event_type": "NODE_DOWN",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "node_id": "abc123",
    "node_name": "Main Router",
    "node_type": "ROUTER",
    "group_name": "Server Room",
    "ip_address": "192.168.1.1",
    "previous_status": "ONLINE",
    "new_status": "OFFLINE"
  }
}
```

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

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings |
| POST | `/api/settings/change-password` | Change admin password |

### Setup (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/setup/status` | Check if setup is complete |
| POST | `/api/setup/initialize` | Initialize system with password |

## Authentication

Starlight uses a simple admin password authentication system to protect your network monitoring dashboard.

### First-Time Setup

When you first access Starlight, you'll be guided through a setup wizard to create your admin password. This password is securely hashed and stored in the database.

### Changing the Password

1. Log in to the dashboard
2. Click the **Settings** icon (gear) in the header
3. Go to the **Security** tab
4. Enter your current password and new password
5. Click **Change Password**

Note: Changing your password will log you out of all sessions.

### Security Notes

- Passwords are hashed using PBKDF2 with SHA-512
- Session tokens use HMAC-SHA256 for generation
- Tokens are stored in the browser's localStorage
- Session secrets are auto-generated and stored in the database

## Troubleshooting

### Probes not showing status updates

1. Check MQTT broker is running: `docker compose logs mqtt-broker`
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

1. Check PostgreSQL container is healthy: `docker compose ps`
2. Verify DATABASE_URL in docker-compose.yml
3. Check backend logs: `docker compose logs backend`

### Setup wizard not appearing

1. Ensure all containers are running: `docker compose ps`
2. Check backend logs for errors: `docker compose logs backend`
3. Try clearing browser cache and localStorage

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
