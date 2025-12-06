import { useState, useEffect, FormEvent } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Shield, 
  Webhook, 
  Activity,
  Lock,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Send,
  Zap,
  Trash2,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  usePerformanceSettings, 
  setAnimationMode, 
  setGlowEffectsEnabled,
  type AnimationMode 
} from '../../hooks/useGlobalAnimation';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PublicSettings {
  isSetupComplete: boolean;
  n8nWebhookUrl: string | null;
  n8nWebhookConfigured: boolean;
  probeTimeoutMs: number;
  statusHistoryRetentionDays: number;
  internetCheckTargets: string;
  // Performance settings
  monitoringIntervalMs: number;
  monitoringConcurrency: number;
  enableStatusHistory: boolean;
  statusHistoryCleanupEnabled: boolean;
}

interface StatusHistoryStats {
  totalRecords: number;
  oldestRecord: string | null;
  newestRecord: string | null;
}

// API base URL
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.port === '8080' 
    ? 'http://localhost:4000'
    : '';
})();

type TabId = 'security' | 'webhooks' | 'monitoring' | 'performance';

export function Settings({ isOpen, onClose }: SettingsProps) {
  const { logout, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('security');
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Webhooks tab state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Monitoring tab state
  const [probeTimeout, setProbeTimeout] = useState('5000');
  const [retentionDays, setRetentionDays] = useState('30');
  const [internetTargets, setInternetTargets] = useState('');
  const [isSavingMonitoring, setIsSavingMonitoring] = useState(false);

  // Performance tab state (local settings from hook)
  const perfSettings = usePerformanceSettings();
  
  // Performance tab state (server settings)
  const [monitoringInterval, setMonitoringInterval] = useState('60000');
  const [monitoringConcurrency, setMonitoringConcurrency] = useState('10');
  const [enableStatusHistory, setEnableStatusHistory] = useState(true);
  const [statusHistoryCleanupEnabled, setStatusHistoryCleanupEnabled] = useState(true);
  const [isSavingPerformance, setIsSavingPerformance] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [historyStats, setHistoryStats] = useState<StatusHistoryStats | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchHistoryStats();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to load settings');
        setIsLoading(false);
        return;
      }
      
      setSettings(data.data);
      setWebhookUrl(data.data.n8nWebhookUrl || '');
      setProbeTimeout(String(data.data.probeTimeoutMs));
      setRetentionDays(String(data.data.statusHistoryRetentionDays));
      setInternetTargets(data.data.internetCheckTargets);
      // Performance settings
      setMonitoringInterval(String(data.data.monitoringIntervalMs));
      setMonitoringConcurrency(String(data.data.monitoringConcurrency));
      setEnableStatusHistory(data.data.enableStatusHistory);
      setStatusHistoryCleanupEnabled(data.data.statusHistoryCleanupEnabled);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistoryStats = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings/status-history-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setHistoryStats(data.data);
      }
    } catch (err) {
      // Silently fail - stats are not critical
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to change password');
        setIsChangingPassword(false);
        return;
      }

      setSuccess('Password changed successfully. Please log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      
      // Log out after password change
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveWebhooks = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSavingWebhook(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          n8nWebhookUrl: webhookUrl || null,
          n8nWebhookSecret: webhookSecret || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to save webhook settings');
        return;
      }

      setSuccess('Webhook settings saved successfully');
      setSettings(data.data);
      setWebhookSecret(''); // Clear secret after save for security
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    setError('');
    setSuccess('');
    setIsTestingWebhook(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/webhooks/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Webhook test failed');
        return;
      }

      setSuccess('Test webhook sent successfully!');
    } catch (err) {
      setError('Failed to send test webhook');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSaveMonitoring = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSavingMonitoring(true);

    const timeout = parseInt(probeTimeout, 10);
    const retention = parseInt(retentionDays, 10);

    if (isNaN(timeout) || timeout < 1000) {
      setError('Probe timeout must be at least 1000ms');
      setIsSavingMonitoring(false);
      return;
    }

    if (isNaN(retention) || retention < 1) {
      setError('Retention days must be at least 1');
      setIsSavingMonitoring(false);
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          probeTimeoutMs: timeout,
          statusHistoryRetentionDays: retention,
          internetCheckTargets: internetTargets,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to save monitoring settings');
        return;
      }

      setSuccess('Monitoring settings saved successfully');
      setSettings(data.data);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsSavingMonitoring(false);
    }
  };

  const handleSavePerformance = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSavingPerformance(true);

    const interval = parseInt(monitoringInterval, 10);
    const concurrency = parseInt(monitoringConcurrency, 10);

    if (isNaN(interval) || interval < 10000) {
      setError('Monitoring interval must be at least 10 seconds (10000ms)');
      setIsSavingPerformance(false);
      return;
    }

    if (isNaN(concurrency) || concurrency < 1 || concurrency > 50) {
      setError('Monitoring concurrency must be between 1 and 50');
      setIsSavingPerformance(false);
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          monitoringIntervalMs: interval,
          monitoringConcurrency: concurrency,
          enableStatusHistory,
          statusHistoryCleanupEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to save performance settings');
        return;
      }

      setSuccess('Performance settings saved successfully');
      setSettings(data.data);
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsSavingPerformance(false);
    }
  };

  const handleCleanupHistory = async () => {
    setError('');
    setSuccess('');
    setIsCleaningUp(true);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/settings/cleanup-status-history`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to cleanup status history');
        return;
      }

      setSuccess(`Cleaned up ${data.data.deletedCount} old status history records`);
      fetchHistoryStats(); // Refresh stats
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleAnimationModeChange = (mode: AnimationMode) => {
    setAnimationMode(mode);
    setSuccess(`Animation mode set to ${mode}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleGlowEffectsChange = (enabled: boolean) => {
    setGlowEffectsEnabled(enabled);
    setSuccess(`Glow effects ${enabled ? 'enabled' : 'disabled'}`);
    setTimeout(() => setSuccess(''), 2000);
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'security' as TabId, label: 'Security', icon: Shield },
    { id: 'webhooks' as TabId, label: 'Webhooks', icon: Webhook },
    { id: 'monitoring' as TabId, label: 'Monitoring', icon: Activity },
    { id: 'performance' as TabId, label: 'Performance', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue/20 via-neon-purple/20 to-neon-pink/20 rounded-lg blur-xl opacity-50" />
        
        <div className="relative glass-dark rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-500">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-neon-blue" />
              <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">
                Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-dark-500">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError('');
                  setSuccess('');
                }}
                className={`flex items-center gap-2 px-6 py-3 font-display text-sm uppercase tracking-wider transition-all
                  ${activeTab === tab.id 
                    ? 'text-neon-blue border-b-2 border-neon-blue bg-neon-blue/5' 
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
              </div>
            ) : (
              <>
                {/* Messages */}
                {error && (
                  <div className="mb-6 p-4 rounded bg-neon-pink/10 border border-neon-pink/30 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-neon-pink flex-shrink-0" />
                    <p className="text-neon-pink text-sm font-body">{error}</p>
                  </div>
                )}
                {success && (
                  <div className="mb-6 p-4 rounded bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-green-500 text-sm font-body">{success}</p>
                  </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                  <form onSubmit={handleChangePassword} className="space-y-6">
                    <div>
                      <h3 className="text-lg font-display text-white mb-4">Change Password</h3>
                      <p className="text-gray-400 text-sm mb-6">
                        Update your admin password. You will be logged out after changing.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="w-5 h-5 text-gray-500" />
                        </div>
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-3 bg-dark-800 border border-dark-500 rounded
                                   text-white font-body placeholder-gray-500
                                   focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                          placeholder="Enter current password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="w-5 h-5 text-gray-500" />
                        </div>
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-3 bg-dark-800 border border-dark-500 rounded
                                   text-white font-body placeholder-gray-500
                                   focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                          placeholder="Enter new password (min 6 chars)"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="w-5 h-5 text-gray-500" />
                        </div>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className={`w-full pl-12 pr-4 py-3 bg-dark-800 border rounded
                                   text-white font-body placeholder-gray-500
                                   focus:outline-none focus:ring-1
                                   ${confirmNewPassword && newPassword !== confirmNewPassword
                                     ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                     : confirmNewPassword && newPassword === confirmNewPassword
                                     ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                                     : 'border-dark-500 focus:border-neon-blue focus:ring-neon-blue'
                                   }`}
                          placeholder="Confirm new password"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmNewPassword}
                      className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                               bg-transparent border-2 border-neon-blue text-neon-blue rounded
                               transition-all duration-300 ease-out
                               hover:bg-neon-blue hover:text-dark-900
                               disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Change Password
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Webhooks Tab */}
                {activeTab === 'webhooks' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-display text-white mb-4">n8n Webhook Integration</h3>
                      <p className="text-gray-400 text-sm mb-6">
                        Configure webhook URL to receive network event notifications (e.g., for WhatsApp alerts via n8n).
                      </p>
                    </div>

                    <form onSubmit={handleSaveWebhooks} className="space-y-6">
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                          Webhook URL
                        </label>
                        <input
                          type="url"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                          className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                   text-white font-body placeholder-gray-500
                                   focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                          placeholder="https://your-n8n-server/webhook/..."
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {settings?.n8nWebhookConfigured 
                            ? 'Webhook is currently configured' 
                            : 'No webhook configured'
                          }
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                          Webhook Secret (optional)
                        </label>
                        <div className="relative">
                          <input
                            type={showWebhookSecret ? 'text' : 'password'}
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            className="w-full px-4 pr-12 py-3 bg-dark-800 border border-dark-500 rounded
                                     text-white font-body placeholder-gray-500
                                     focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                            placeholder="HMAC signing secret"
                          />
                          <button
                            type="button"
                            onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                          >
                            {showWebhookSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Used to sign webhook payloads (X-Webhook-Signature header)
                        </p>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="submit"
                          disabled={isSavingWebhook}
                          className="flex-1 py-3 px-6 font-display font-semibold uppercase tracking-wider
                                   bg-transparent border-2 border-neon-blue text-neon-blue rounded
                                   transition-all duration-300 ease-out
                                   hover:bg-neon-blue hover:text-dark-900
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center justify-center gap-2"
                        >
                          {isSavingWebhook ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              Save Webhook
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleTestWebhook}
                          disabled={isTestingWebhook || !settings?.n8nWebhookConfigured}
                          className="py-3 px-6 font-display font-semibold uppercase tracking-wider
                                   bg-transparent border-2 border-neon-purple text-neon-purple rounded
                                   transition-all duration-300 ease-out
                                   hover:bg-neon-purple hover:text-dark-900
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   flex items-center justify-center gap-2"
                        >
                          {isTestingWebhook ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                          Test
                        </button>
                      </div>
                    </form>

                    {/* Event types info */}
                    <div className="mt-8 p-4 bg-dark-800/50 rounded border border-dark-600">
                      <h4 className="text-sm font-display text-gray-300 uppercase tracking-wide mb-3">
                        Supported Events
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <div>• NODE_DOWN - Node goes offline</div>
                        <div>• NODE_UP - Node comes online</div>
                        <div>• INTERNET_DOWN - Internet lost</div>
                        <div>• INTERNET_UP - Internet restored</div>
                        <div>• ISP_CHANGED - Active ISP changed</div>
                        <div>• GROUP_DEGRADED - Group issues</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Monitoring Tab */}
                {activeTab === 'monitoring' && (
                  <form onSubmit={handleSaveMonitoring} className="space-y-6">
                    <div>
                      <h3 className="text-lg font-display text-white mb-4">Monitoring Configuration</h3>
                      <p className="text-gray-400 text-sm mb-6">
                        Configure monitoring behavior and data retention settings.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        Probe Timeout (ms)
                      </label>
                      <input
                        type="number"
                        value={probeTimeout}
                        onChange={(e) => setProbeTimeout(e.target.value)}
                        min="1000"
                        step="1000"
                        className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                 text-white font-body placeholder-gray-500
                                 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                        placeholder="5000"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Time before marking a probe as offline (minimum 1000ms)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        Status History Retention (days)
                      </label>
                      <input
                        type="number"
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(e.target.value)}
                        min="1"
                        max="365"
                        className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                 text-white font-body placeholder-gray-500
                                 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                        placeholder="30"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        How long to keep probe status history for analytics
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                        Internet Check Targets
                      </label>
                      <input
                        type="text"
                        value={internetTargets}
                        onChange={(e) => setInternetTargets(e.target.value)}
                        className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                 text-white font-body placeholder-gray-500
                                 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                        placeholder="8.8.8.8,1.1.1.1,208.67.222.222"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Comma-separated IPs used by probes to check internet connectivity
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingMonitoring}
                      className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                               bg-transparent border-2 border-neon-blue text-neon-blue rounded
                               transition-all duration-300 ease-out
                               hover:bg-neon-blue hover:text-dark-900
                               disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2"
                    >
                      {isSavingMonitoring ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Save Monitoring Settings
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Performance Tab */}
                {activeTab === 'performance' && (
                  <div className="space-y-8">
                    {/* Client-side Performance Settings */}
                    <div>
                      <h3 className="text-lg font-display text-white mb-4">Visual Performance</h3>
                      <p className="text-gray-400 text-sm mb-6">
                        Adjust visual effects to reduce CPU/GPU usage. Changes are applied immediately and saved locally.
                      </p>

                      {/* Animation Mode */}
                      <div className="mb-6">
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-3">
                          Animation Mode
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['full', 'reduced', 'off'] as AnimationMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleAnimationModeChange(mode)}
                              className={`py-3 px-4 rounded border-2 font-display text-sm uppercase tracking-wider transition-all
                                ${perfSettings.animationMode === mode
                                  ? 'border-neon-blue bg-neon-blue/20 text-neon-blue'
                                  : 'border-dark-500 text-gray-400 hover:border-gray-400'
                                }`}
                            >
                              {mode === 'full' && '🎨 Full'}
                              {mode === 'reduced' && '⚡ Reduced'}
                              {mode === 'off' && '🔋 Off'}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          {perfSettings.animationMode === 'full' && 'All animations enabled at full frame rate'}
                          {perfSettings.animationMode === 'reduced' && 'Animations run at reduced frame rate (15 FPS)'}
                          {perfSettings.animationMode === 'off' && 'All animations disabled for maximum performance'}
                        </p>
                      </div>

                      {/* Glow Effects */}
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-3">
                          Glow Effects
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleGlowEffectsChange(!perfSettings.enableGlowEffects)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                              ${perfSettings.enableGlowEffects ? 'bg-neon-blue' : 'bg-dark-600'}`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                                ${perfSettings.enableGlowEffects ? 'translate-x-7' : 'translate-x-1'}`}
                            />
                          </button>
                          <span className="text-sm text-gray-400">
                            {perfSettings.enableGlowEffects ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Disable to reduce GPU usage from shadow and blur effects
                        </p>
                      </div>
                    </div>

                    <hr className="border-dark-500" />

                    {/* Server-side Performance Settings */}
                    <form onSubmit={handleSavePerformance} className="space-y-6">
                      <div>
                        <h3 className="text-lg font-display text-white mb-4">Server Performance</h3>
                        <p className="text-gray-400 text-sm mb-6">
                          Configure backend monitoring frequency and resource usage.
                        </p>
                      </div>

                      {/* Monitoring Interval */}
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                          Monitoring Interval
                        </label>
                        <select
                          value={monitoringInterval}
                          onChange={(e) => setMonitoringInterval(e.target.value)}
                          className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                   text-white font-body
                                   focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                        >
                          <option value="15000">15 seconds (High frequency)</option>
                          <option value="30000">30 seconds</option>
                          <option value="60000">60 seconds (Default)</option>
                          <option value="120000">2 minutes</option>
                          <option value="300000">5 minutes (Low frequency)</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          How often the server checks node status. Lower = more responsive but higher resource usage.
                        </p>
                      </div>

                      {/* Monitoring Concurrency */}
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                          Parallel Checks
                        </label>
                        <input
                          type="number"
                          value={monitoringConcurrency}
                          onChange={(e) => setMonitoringConcurrency(e.target.value)}
                          min="1"
                          max="50"
                          className="w-full px-4 py-3 bg-dark-800 border border-dark-500 rounded
                                   text-white font-body placeholder-gray-500
                                   focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                          placeholder="10"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Maximum number of nodes checked simultaneously (1-50). Lower = less network/CPU load.
                        </p>
                      </div>

                      {/* Status History Toggle */}
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-3">
                          Record Status History
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setEnableStatusHistory(!enableStatusHistory)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                              ${enableStatusHistory ? 'bg-neon-blue' : 'bg-dark-600'}`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                                ${enableStatusHistory ? 'translate-x-7' : 'translate-x-1'}`}
                            />
                          </button>
                          <span className="text-sm text-gray-400">
                            {enableStatusHistory ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Disable to reduce database writes. Analytics will not be available.
                        </p>
                      </div>

                      {/* Auto Cleanup Toggle */}
                      <div>
                        <label className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-3">
                          Auto-cleanup Old Records
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setStatusHistoryCleanupEnabled(!statusHistoryCleanupEnabled)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors
                              ${statusHistoryCleanupEnabled ? 'bg-neon-blue' : 'bg-dark-600'}`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform
                                ${statusHistoryCleanupEnabled ? 'translate-x-7' : 'translate-x-1'}`}
                            />
                          </button>
                          <span className="text-sm text-gray-400">
                            {statusHistoryCleanupEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Automatically delete records older than the retention period (hourly check)
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingPerformance}
                        className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                                 bg-transparent border-2 border-neon-blue text-neon-blue rounded
                                 transition-all duration-300 ease-out
                                 hover:bg-neon-blue hover:text-dark-900
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center justify-center gap-2"
                      >
                        {isSavingPerformance ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save Server Settings
                          </>
                        )}
                      </button>
                    </form>

                    <hr className="border-dark-500" />

                    {/* Database Status & Cleanup */}
                    <div>
                      <h3 className="text-lg font-display text-white mb-4">Database Management</h3>
                      
                      {/* History Stats */}
                      {historyStats && (
                        <div className="mb-6 p-4 bg-dark-800/50 rounded border border-dark-600">
                          <div className="flex items-center gap-2 mb-3">
                            <Database className="w-4 h-4 text-neon-purple" />
                            <span className="text-sm font-display text-gray-300 uppercase tracking-wide">
                              Status History
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-display text-white">
                                {historyStats.totalRecords.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">Total Records</div>
                            </div>
                            <div>
                              <div className="text-sm font-body text-gray-300">
                                {historyStats.oldestRecord 
                                  ? new Date(historyStats.oldestRecord).toLocaleDateString()
                                  : 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">Oldest</div>
                            </div>
                            <div>
                              <div className="text-sm font-body text-gray-300">
                                {historyStats.newestRecord 
                                  ? new Date(historyStats.newestRecord).toLocaleDateString()
                                  : 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">Newest</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleCleanupHistory}
                        disabled={isCleaningUp}
                        className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                                 bg-transparent border-2 border-neon-pink text-neon-pink rounded
                                 transition-all duration-300 ease-out
                                 hover:bg-neon-pink hover:text-dark-900
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center justify-center gap-2"
                      >
                        {isCleaningUp ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Cleaning...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-5 h-5" />
                            Cleanup Old Records Now
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        Deletes records older than the configured retention period
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

