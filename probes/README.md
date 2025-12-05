# Starlight Network Probes

This directory contains firmware examples for network probes that work with the Starlight Network Monitor.

## Supported Hardware

### ESP32 (Recommended)
- **Cost**: ~$5-10
- **Features**: WiFi, Bluetooth, OTA updates
- **Best for**: Most deployments

### ESP8266 / NodeMCU
- **Cost**: ~$3-5
- **Features**: WiFi only
- **Best for**: Budget deployments

### Arduino with Ethernet Shield
- **Cost**: ~$15-25
- **Features**: Wired connection
- **Best for**: Reliable, wired connections

## Quick Start

### ESP32 Probe

1. **Install PlatformIO**
   ```bash
   pip install platformio
   ```

2. **Configure the probe**
   Edit `esp32-probe/esp32-probe.ino`:
   - Set your WiFi credentials
   - Set your MQTT broker IP (Docker host IP)
   - Set a unique NODE_ID

3. **Build and upload**
   ```bash
   cd esp32-probe
   pio run --target upload
   ```

4. **Configure in Starlight**
   - Add a new node in the Starlight UI
   - Set the MQTT topic to match: `network/probes/{NODE_ID}/status`

## MQTT Message Format

### Status Message
Published to: `network/probes/{nodeId}/status`

```json
{
  "status": "online",
  "internetStatus": "online",
  "latency": 23,
  "rssi": -45,
  "uptime": 3600,
  "ip": "192.168.1.50"
}
```

### Heartbeat Message
Published to: `network/probes/{nodeId}/heartbeat`

```json
{
  "ts": 123456789
}
```

## LED Indicators

The ESP32 probe uses the built-in LED to show status:

| Pattern | Meaning |
|---------|---------|
| Solid ON | Network + Internet OK |
| Slow blink | Network OK, No Internet |
| Fast blink | No Network Connection |

## Troubleshooting

### Probe not connecting to WiFi
- Check SSID and password are correct
- Ensure 2.4GHz network (ESP32/8266 don't support 5GHz)
- Check WiFi signal strength

### Probe not appearing in Starlight
- Verify MQTT broker is reachable from probe
- Check NODE_ID matches the configured MQTT topic
- Monitor serial output for error messages

### Intermittent disconnections
- Check power supply (use good quality USB power)
- Consider adding a capacitor for power stability
- Check for WiFi interference

## Building Custom Probes

You can build probes using any platform that supports:
- TCP/IP networking
- MQTT client library

The probe just needs to:
1. Connect to your local network
2. Publish status messages to the MQTT broker
3. Optionally check internet connectivity

See the ESP32 example for the full message format.

