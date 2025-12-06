/**
 * Webhook Management Routes
 * Endpoints for managing and testing n8n webhook integration
 */

import { Router, Request, Response } from 'express';
import { 
  getWebhookStatus, 
  sendTestWebhook, 
  triggerNodeDown,
  triggerNodeUp,
  triggerInternetDown,
  triggerInternetUp,
  triggerIspChanged,
  triggerGroupDegraded,
  isWebhookEnabled,
} from '../services/webhookService';

export const webhooksRouter = Router();

// GET /api/webhooks/status - Get webhook configuration status
webhooksRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getWebhookStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting webhook status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook status',
    });
  }
});

// POST /api/webhooks/test - Send a test webhook event
webhooksRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await sendTestWebhook();
    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Error sending test webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test webhook',
    });
  }
});

// POST /api/webhooks/simulate - Simulate a specific event type (for testing)
webhooksRouter.post('/simulate/:eventType', async (req: Request, res: Response) => {
  const { eventType } = req.params;
  const { data } = req.body;

  const webhookEnabled = await isWebhookEnabled();
  if (!webhookEnabled) {
    return res.status(400).json({
      success: false,
      error: 'Webhooks not configured. Configure webhook URL in Settings.',
    });
  }

  try {
    switch (eventType) {
      case 'NODE_DOWN':
        triggerNodeDown({
          node_id: data?.node_id || 'test-node-id',
          node_name: data?.node_name || 'Test Node',
          node_type: data?.node_type || 'SERVER',
          new_status: 'OFFLINE',
          previous_status: 'ONLINE',
        });
        break;

      case 'NODE_UP':
        triggerNodeUp({
          node_id: data?.node_id || 'test-node-id',
          node_name: data?.node_name || 'Test Node',
          node_type: data?.node_type || 'SERVER',
          new_status: 'ONLINE',
          previous_status: 'OFFLINE',
          downtime_seconds: data?.downtime_seconds || 300,
        });
        break;

      case 'INTERNET_DOWN':
        triggerInternetDown({
          node_id: data?.node_id || 'test-internet-id',
          node_name: data?.node_name || 'Primary ISP',
          new_status: 'OFFLINE',
          previous_status: 'ONLINE',
        });
        break;

      case 'INTERNET_UP':
        triggerInternetUp({
          node_id: data?.node_id || 'test-internet-id',
          node_name: data?.node_name || 'Primary ISP',
          new_status: 'ONLINE',
          previous_status: 'OFFLINE',
          downtime_seconds: data?.downtime_seconds || 120,
        });
        break;

      case 'ISP_CHANGED':
        triggerIspChanged({
          old_isp: data?.old_isp || 'Old ISP',
          new_isp: data?.new_isp || 'New ISP',
          public_ip: data?.public_ip || '1.2.3.4',
          matched_node_name: data?.matched_node_name || 'Backup ISP',
        });
        break;

      case 'GROUP_DEGRADED':
        triggerGroupDegraded({
          group_id: data?.group_id || 'test-group-id',
          group_name: data?.group_name || 'Test Group',
          total_nodes: data?.total_nodes || 10,
          offline_nodes: data?.offline_nodes || 6,
          affected_node_names: data?.affected_node_names || ['Node 1', 'Node 2', 'Node 3'],
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unknown event type: ${eventType}. Valid types: NODE_DOWN, NODE_UP, INTERNET_DOWN, INTERNET_UP, ISP_CHANGED, GROUP_DEGRADED`,
        });
    }

    res.json({
      success: true,
      message: `Simulated ${eventType} event queued for delivery`,
    });
  } catch (error) {
    console.error('Error simulating webhook event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate webhook event',
    });
  }
});

// GET /api/webhooks/events - List supported event types
webhooksRouter.get('/events', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      event_types: [
        {
          type: 'ISP_CHANGED',
          description: 'Triggered when the active ISP connection switches',
          payload_fields: ['old_isp', 'new_isp', 'public_ip', 'matched_node_id', 'matched_node_name'],
        },
        {
          type: 'NODE_DOWN',
          description: 'Triggered when a monitored node goes offline',
          payload_fields: ['node_id', 'node_name', 'node_type', 'group_name', 'ip_address', 'previous_status'],
        },
        {
          type: 'NODE_UP',
          description: 'Triggered when a monitored node comes back online',
          payload_fields: ['node_id', 'node_name', 'node_type', 'group_name', 'ip_address', 'downtime_seconds'],
        },
        {
          type: 'INTERNET_DOWN',
          description: 'Triggered when internet connectivity is lost',
          payload_fields: ['isp_name', 'node_id', 'node_name', 'previous_status'],
        },
        {
          type: 'INTERNET_UP',
          description: 'Triggered when internet connectivity is restored',
          payload_fields: ['isp_name', 'node_id', 'node_name', 'downtime_seconds'],
        },
        {
          type: 'GROUP_DEGRADED',
          description: 'Triggered when 50% or more nodes in a group go offline',
          payload_fields: ['group_id', 'group_name', 'total_nodes', 'offline_nodes', 'affected_node_names'],
        },
        {
          type: 'TEST',
          description: 'Test event for verifying webhook connectivity',
          payload_fields: ['message', 'configured_url'],
        },
      ],
    },
  });
});

