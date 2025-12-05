import mqtt, { MqttClient } from 'mqtt';
import { prisma } from '../server';
import { broadcastMessage } from './websocketService';
import { ProbeStatusMessageSchema, Status } from '../types';

let mqttClient: MqttClient | null = null;

// MQTT Topics
const TOPICS = {
  PROBE_STATUS: 'network/probes/+/status',
  PROBE_HEARTBEAT: 'network/probes/+/heartbeat',
  PROBE_INTERNET: 'network/probes/+/internet',
  SYSTEM_ALERTS: 'network/system/alerts',
};

/**
 * Initialize MQTT service and connect to broker
 */
export async function initMqttService(): Promise<void> {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  
  return new Promise((resolve, reject) => {
    mqttClient = mqtt.connect(brokerUrl, {
      clientId: `starlight-backend-${Date.now()}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 5000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });

    mqttClient.on('connect', () => {
      console.log('🔌 Connected to MQTT broker');
      
      // Subscribe to all relevant topics
      Object.values(TOPICS).forEach((topic) => {
        mqttClient?.subscribe(topic, (err) => {
          if (err) {
            console.error(`Failed to subscribe to ${topic}:`, err);
          } else {
            console.log(`  📥 Subscribed to: ${topic}`);
          }
        });
      });

      resolve();
    });

    mqttClient.on('message', handleMqttMessage);

    mqttClient.on('error', (error) => {
      console.error('MQTT error:', error);
    });

    mqttClient.on('reconnect', () => {
      console.log('🔄 Reconnecting to MQTT broker...');
    });

    mqttClient.on('offline', () => {
      console.log('📴 MQTT client offline');
    });

    // Timeout for initial connection
    setTimeout(() => {
      if (!mqttClient?.connected) {
        console.warn('⚠️ MQTT broker not available, continuing without MQTT');
        resolve();
      }
    }, 5000);
  });
}

/**
 * Handle incoming MQTT messages
 */
async function handleMqttMessage(topic: string, message: Buffer): Promise<void> {
  try {
    const payload = JSON.parse(message.toString());
    const topicParts = topic.split('/');
    
    // Extract node ID from topic (network/probes/{nodeId}/status)
    if (topicParts.length >= 4 && topicParts[0] === 'network' && topicParts[1] === 'probes') {
      const mqttNodeId = topicParts[2];
      const messageType = topicParts[3];

      switch (messageType) {
        case 'status':
          await handleProbeStatus(mqttNodeId, payload);
          break;
        case 'heartbeat':
          await handleProbeHeartbeat(mqttNodeId, payload);
          break;
        case 'internet':
          await handleInternetStatus(mqttNodeId, payload);
          break;
        default:
          console.log(`Unknown message type: ${messageType}`);
      }
    } else if (topic === TOPICS.SYSTEM_ALERTS) {
      await handleSystemAlert(payload);
    }
  } catch (error) {
    console.error('Error processing MQTT message:', error);
  }
}

/**
 * Handle probe status update
 */
async function handleProbeStatus(mqttNodeId: string, payload: any): Promise<void> {
  try {
    // Find node by MQTT topic
    const node = await prisma.node.findFirst({
      where: {
        OR: [
          { mqttTopic: `network/probes/${mqttNodeId}/status` },
          { mqttTopic: mqttNodeId },
          { id: mqttNodeId },
        ],
      },
    });

    if (!node) {
      console.log(`No node found for MQTT ID: ${mqttNodeId}`);
      return;
    }

    const status = payload.status?.toUpperCase() as Status || 'UNKNOWN';
    const latency = typeof payload.latency === 'number' ? payload.latency : null;

    // Update node status
    const updatedNode = await prisma.node.update({
      where: { id: node.id },
      data: {
        status,
        latency,
        lastSeen: new Date(),
      },
    });

    // Record status history
    await prisma.probeStatus.create({
      data: {
        nodeId: node.id,
        status,
        latency,
        message: payload.message,
      },
    });

    // Broadcast status update to WebSocket clients
    broadcastMessage({
      type: 'NODE_STATUS_UPDATE',
      payload: {
        nodeId: node.id,
        status,
        latency,
        lastSeen: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`📊 Status update for ${node.name}: ${status}`);
  } catch (error) {
    console.error('Error handling probe status:', error);
  }
}

/**
 * Handle probe heartbeat (lightweight status ping)
 */
async function handleProbeHeartbeat(mqttNodeId: string, payload: any): Promise<void> {
  try {
    const node = await prisma.node.findFirst({
      where: {
        OR: [
          { mqttTopic: `network/probes/${mqttNodeId}/status` },
          { mqttTopic: mqttNodeId },
          { id: mqttNodeId },
        ],
      },
    });

    if (!node) return;

    // Update last seen timestamp
    await prisma.node.update({
      where: { id: node.id },
      data: {
        lastSeen: new Date(),
        status: 'ONLINE',
      },
    });
  } catch (error) {
    console.error('Error handling heartbeat:', error);
  }
}

/**
 * Handle internet connectivity status update
 */
async function handleInternetStatus(mqttNodeId: string, payload: any): Promise<void> {
  try {
    const node = await prisma.node.findFirst({
      where: {
        OR: [
          { mqttTopic: `network/probes/${mqttNodeId}/status` },
          { mqttTopic: mqttNodeId },
          { id: mqttNodeId },
        ],
      },
    });

    if (!node) return;

    const internetStatus = payload.status?.toUpperCase() as Status || 'UNKNOWN';

    // Update node internet status
    const updatedNode = await prisma.node.update({
      where: { id: node.id },
      data: {
        internetStatus,
        internetLastCheck: new Date(),
      },
    });

    // Record in status history
    await prisma.probeStatus.create({
      data: {
        nodeId: node.id,
        status: node.status as Status,
        internetStatus,
        message: `Internet: ${internetStatus}`,
      },
    });

    // Broadcast to WebSocket clients
    broadcastMessage({
      type: 'NODE_STATUS_UPDATE',
      payload: {
        nodeId: node.id,
        internetStatus,
        internetLastCheck: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`🌐 Internet status for ${node.name}: ${internetStatus}`);
  } catch (error) {
    console.error('Error handling internet status:', error);
  }
}

/**
 * Handle system-wide alerts
 */
async function handleSystemAlert(payload: any): Promise<void> {
  console.log('🚨 System alert:', payload);
  
  broadcastMessage({
    type: 'NETWORK_UPDATE',
    payload: {
      type: 'alert',
      ...payload,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Publish a message to MQTT
 */
export function publishMessage(topic: string, payload: object): void {
  if (mqttClient?.connected) {
    mqttClient.publish(topic, JSON.stringify(payload));
  } else {
    console.warn('MQTT client not connected, cannot publish');
  }
}

/**
 * Get MQTT connection status
 */
export function getMqttStatus(): { connected: boolean; broker: string } {
  return {
    connected: mqttClient?.connected || false,
    broker: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  };
}




