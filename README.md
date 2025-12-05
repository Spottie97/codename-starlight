# Starlight Network Monitor

A local network monitoring tool with a game-like visualization interface. Monitor your network infrastructure in real-time using distributed probes (Arduino/ESP32 devices) that communicate via MQTT. Designed to work **completely offline** on your local network.

![Starlight Logo](frontend/public/starlight.svg)

## Features

- **Visual Network Builder**: Drag-and-drop interface to create your network topology
- **Real-time Monitoring**: Live status updates via WebSocket connections
- **Dual Status Tracking**: Monitor both local network connectivity AND internet connectivity separately
- **Game-like UI**: Cyberpunk-inspired interface with animations and visual effects
- **Offline-First**: Works entirely on your local network, no cloud dependencies
- **MQTT Integration**: Lightweight protocol for probe communication
- **Modular Design**: Add as many probes as you need to cover your network

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │◄──►│   Backend    │◄──►│  PostgreSQL  │       │
│  │  (React/Vite)│    │  (Node.js)   │    │              │       │
│  │   Port 3000  │    │   Port 4000  │    │   Port 5432  │       │
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
- Node.js 20+ (for local development)

### Running with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/codename-starlight.git
   cd codename-starlight
   ```

2. **Copy environment file**
   ```bash
   cp env.example .env
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - MQTT Broker: mqtt://localhost:1883

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
2. **Place Nodes**: Click anywhere on the canvas to add a new probe node
3. **Connect Nodes**: Switch to "Connect" mode and click two nodes to link them
4. **Configure Nodes**: Click on a node to edit its name, MQTT topic, and color

### Editor Modes

| Mode | Shortcut | Description |
|------|----------|-------------|
| Select | V | Select and drag nodes, pan canvas |
| Add | A | Add new nodes by clicking on canvas |
| Connect | C | Create connections between nodes |
| Delete | D | Remove nodes or connections |

### Canvas Controls

- **Zoom**: Use toolbar buttons or scroll wheel
- **Pan**: Drag on empty canvas space (in Select mode)
- **Reset View**: Click the maximize button to reset zoom and position

## Probe Configuration

### Arduino/ESP32 Probe Setup

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
| DELETE | `/api/connections/:id` | Delete connection |

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Backend server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `MQTT_BROKER_URL` | mqtt://localhost:1883 | MQTT broker URL |
| `PROBE_TIMEOUT` | 30000 | Timeout to mark probe offline (ms) |
| `VITE_API_URL` | - | Backend API URL for frontend |
| `VITE_WS_URL` | - | WebSocket URL for frontend |

## Troubleshooting

### Probes not showing status updates

1. Check MQTT broker is running: `docker-compose logs mqtt-broker`
2. Verify probe is publishing to correct topic
3. Ensure MQTT topic in node config matches probe topic

### WebSocket connection failing

1. Verify backend is running on port 4000
2. Check browser console for connection errors
3. Ensure firewall allows WebSocket connections

### Database connection issues

1. Check PostgreSQL container is healthy: `docker-compose ps`
2. Verify DATABASE_URL in .env file
3. Run migrations: `cd backend && npm run db:push`

## Technology Stack

**Frontend**
- React 18 with TypeScript
- Konva.js for canvas visualization
- Zustand for state management
- TailwindCSS for styling
- Framer Motion for animations

**Backend**
- Node.js with Express
- Prisma ORM
- MQTT.js for broker communication
- WebSocket (ws) for real-time updates

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

Built with ❤️ for reliable network monitoring
