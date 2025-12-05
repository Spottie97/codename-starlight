/**
 * Starlight Network Monitor - ESP32 Probe Firmware
 * 
 * This probe monitors both local network and internet connectivity
 * and reports status to the Starlight backend via MQTT.
 * 
 * Hardware: ESP32 (any variant)
 * 
 * Features:
 * - WiFi connectivity monitoring
 * - Internet connectivity check (DNS ping)
 * - MQTT status reporting
 * - LED status indicators
 * - Watchdog timer for reliability
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

// ===========================================
// CONFIGURATION - MODIFY THESE VALUES
// ===========================================

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT Configuration
const char* MQTT_SERVER = "192.168.1.100";  // IP of your Docker host running Starlight
const int MQTT_PORT = 1883;
const char* MQTT_USER = "";  // Leave empty if no auth
const char* MQTT_PASSWORD = "";

// Probe Configuration
const char* NODE_ID = "probe-001";  // Unique ID for this probe
const char* LOCATION = "Office";     // Human-readable location

// Timing Configuration
const unsigned long STATUS_INTERVAL = 5000;    // Send status every 5 seconds
const unsigned long HEARTBEAT_INTERVAL = 1000; // Heartbeat every 1 second
const unsigned long INTERNET_CHECK_INTERVAL = 10000; // Check internet every 10 seconds

// Internet check targets (DNS servers)
const char* INTERNET_CHECK_HOST = "8.8.8.8";
const int INTERNET_CHECK_PORT = 53;

// LED Pins (optional - set to -1 to disable)
const int LED_STATUS = 2;      // Built-in LED on most ESP32 boards
const int LED_NETWORK = -1;    // Optional: separate network LED
const int LED_INTERNET = -1;   // Optional: separate internet LED

// ===========================================
// INTERNAL VARIABLES
// ===========================================

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// Timing
unsigned long lastStatusTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastInternetCheckTime = 0;

// State
bool networkConnected = false;
bool internetConnected = false;
int wifiRSSI = 0;
unsigned long uptime = 0;

// MQTT Topics
String topicStatus;
String topicHeartbeat;
String topicInternet;

// ===========================================
// SETUP
// ===========================================

void setup() {
  Serial.begin(115200);
  delay(100);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("Starlight Network Probe");
  Serial.println("=================================");
  Serial.print("Node ID: ");
  Serial.println(NODE_ID);
  Serial.print("Location: ");
  Serial.println(LOCATION);
  Serial.println();

  // Setup LED pins
  if (LED_STATUS >= 0) pinMode(LED_STATUS, OUTPUT);
  if (LED_NETWORK >= 0) pinMode(LED_NETWORK, OUTPUT);
  if (LED_INTERNET >= 0) pinMode(LED_INTERNET, OUTPUT);
  
  // Setup MQTT topics
  topicStatus = String("network/probes/") + NODE_ID + "/status";
  topicHeartbeat = String("network/probes/") + NODE_ID + "/heartbeat";
  topicInternet = String("network/probes/") + NODE_ID + "/internet";
  
  // Setup MQTT client
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  
  // Enable watchdog timer (60 seconds)
  esp_task_wdt_init(60, true);
  esp_task_wdt_add(NULL);
  
  // Connect to WiFi
  connectWiFi();
}

// ===========================================
// MAIN LOOP
// ===========================================

void loop() {
  // Reset watchdog
  esp_task_wdt_reset();
  
  unsigned long now = millis();
  uptime = now / 1000;
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    networkConnected = false;
    internetConnected = false;
    connectWiFi();
  } else {
    networkConnected = true;
    wifiRSSI = WiFi.RSSI();
  }
  
  // Maintain MQTT connection
  if (networkConnected && !mqttClient.connected()) {
    connectMQTT();
  }
  
  if (mqttClient.connected()) {
    mqttClient.loop();
  }
  
  // Check internet connectivity
  if (now - lastInternetCheckTime >= INTERNET_CHECK_INTERVAL) {
    lastInternetCheckTime = now;
    internetConnected = checkInternetConnection();
  }
  
  // Send heartbeat
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }
  
  // Send full status
  if (now - lastStatusTime >= STATUS_INTERVAL) {
    lastStatusTime = now;
    sendStatus();
  }
  
  // Update LEDs
  updateLEDs();
  
  delay(100);
}

// ===========================================
// WIFI FUNCTIONS
// ===========================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Blink LED while connecting
    if (LED_STATUS >= 0) {
      digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
    networkConnected = true;
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
    networkConnected = false;
  }
}

// ===========================================
// MQTT FUNCTIONS
// ===========================================

void connectMQTT() {
  if (!networkConnected) return;
  
  Serial.print("Connecting to MQTT broker: ");
  Serial.println(MQTT_SERVER);
  
  String clientId = String("starlight-") + NODE_ID;
  
  bool connected;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
  } else {
    connected = mqttClient.connect(clientId.c_str());
  }
  
  if (connected) {
    Serial.println("MQTT connected!");
    
    // Announce presence
    sendStatus();
  } else {
    Serial.print("MQTT connection failed, rc=");
    Serial.println(mqttClient.state());
  }
}

void sendStatus() {
  if (!mqttClient.connected()) return;
  
  StaticJsonDocument<256> doc;
  
  doc["status"] = networkConnected ? "online" : "offline";
  doc["internetStatus"] = internetConnected ? "online" : "offline";
  doc["latency"] = calculateLatency();
  doc["rssi"] = wifiRSSI;
  doc["uptime"] = uptime;
  doc["location"] = LOCATION;
  doc["ip"] = WiFi.localIP().toString();
  
  char payload[256];
  serializeJson(doc, payload);
  
  if (mqttClient.publish(topicStatus.c_str(), payload)) {
    Serial.print("Status sent: ");
    Serial.println(payload);
  }
}

void sendHeartbeat() {
  if (!mqttClient.connected()) return;
  
  StaticJsonDocument<64> doc;
  doc["ts"] = millis();
  
  char payload[64];
  serializeJson(doc, payload);
  
  mqttClient.publish(topicHeartbeat.c_str(), payload);
}

// ===========================================
// CONNECTIVITY CHECKS
// ===========================================

bool checkInternetConnection() {
  if (!networkConnected) return false;
  
  WiFiClient testClient;
  testClient.setTimeout(3000);
  
  Serial.print("Checking internet... ");
  
  if (testClient.connect(INTERNET_CHECK_HOST, INTERNET_CHECK_PORT)) {
    testClient.stop();
    Serial.println("OK");
    return true;
  }
  
  Serial.println("FAILED");
  return false;
}

int calculateLatency() {
  if (!networkConnected) return -1;
  
  unsigned long start = millis();
  
  WiFiClient testClient;
  testClient.setTimeout(1000);
  
  if (testClient.connect(MQTT_SERVER, MQTT_PORT)) {
    int latency = millis() - start;
    testClient.stop();
    return latency;
  }
  
  return -1;
}

// ===========================================
// LED FUNCTIONS
// ===========================================

void updateLEDs() {
  // Main status LED
  if (LED_STATUS >= 0) {
    if (networkConnected && internetConnected) {
      digitalWrite(LED_STATUS, HIGH);  // Solid on
    } else if (networkConnected) {
      // Slow blink for network only
      digitalWrite(LED_STATUS, (millis() / 500) % 2);
    } else {
      // Fast blink for no network
      digitalWrite(LED_STATUS, (millis() / 100) % 2);
    }
  }
  
  // Separate network LED
  if (LED_NETWORK >= 0) {
    digitalWrite(LED_NETWORK, networkConnected ? HIGH : LOW);
  }
  
  // Separate internet LED
  if (LED_INTERNET >= 0) {
    digitalWrite(LED_INTERNET, internetConnected ? HIGH : LOW);
  }
}




