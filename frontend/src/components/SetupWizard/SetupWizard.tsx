import { useState, FormEvent } from 'react';
import { Lock, AlertCircle, Loader2, CheckCircle, Shield, Eye, EyeOff } from 'lucide-react';

interface SetupWizardProps {
  onSetupComplete: () => void;
}

// API base URL - same logic as api.ts
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.port === '8080' 
    ? 'http://localhost:4000'
    : '';
})();

export function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/setup/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Setup failed');
        setIsLoading(false);
        return;
      }

      // Success!
      setIsComplete(true);
      setTimeout(() => {
        onSetupComplete();
      }, 2000);
    } catch (err) {
      setError('Failed to connect to server');
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Medium', color: 'bg-yellow-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength();

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900 grid-bg relative overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-green-500/30" />
          <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-green-500/30" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-green-500/30" />
          <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-green-500/30" />
          <div className="absolute inset-0 scanline opacity-30" />
        </div>

        <div className="relative w-full max-w-md mx-4">
          <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 rounded-lg blur-xl opacity-50" />
          
          <div className="relative glass-dark rounded-lg shadow-2xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-green-500/10 border border-green-500/30">
                <CheckCircle className="w-12 h-12 text-green-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-green-500 uppercase tracking-wider mb-4">
              Setup Complete
            </h2>
            <p className="text-gray-400 font-body">
              Your system is configured. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 grid-bg relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-neon-purple/30" />
        <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-neon-purple/30" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-neon-purple/30" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-neon-purple/30" />
        
        {/* Scan line effect */}
        <div className="absolute inset-0 scanline opacity-30" />
      </div>

      {/* Setup card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-neon-purple/20 via-neon-pink/20 to-neon-purple/20 rounded-lg blur-xl opacity-50" />
        
        <div className="relative glass-dark rounded-lg shadow-2xl">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-neon-purple/20">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-neon-purple/10 border border-neon-purple/30">
                <Shield className="w-10 h-10 text-neon-purple" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-center text-neon-purple uppercase tracking-wider">
              Welcome to Starlight
            </h1>
            <p className="text-center text-gray-400 mt-2 font-body text-sm">
              First-Time Setup
            </p>
          </div>

          {/* Setup info */}
          <div className="px-8 pt-6 pb-4">
            <div className="p-4 rounded bg-neon-blue/5 border border-neon-blue/20">
              <p className="text-sm text-gray-300 font-body">
                Create an admin password to secure your network monitor. This password will be used to access the dashboard.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8">
            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 rounded bg-neon-pink/10 border border-neon-pink/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-neon-pink flex-shrink-0" />
                <p className="text-neon-pink text-sm font-body">{error}</p>
              </div>
            )}

            {/* Password input */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                Admin Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-dark-800 border border-dark-500 rounded
                           text-white font-body placeholder-gray-500
                           focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple
                           transition-all duration-200"
                  placeholder="Enter password (min 6 chars)"
                  autoFocus
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Password strength indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i <= strength.score ? strength.color : 'bg-dark-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Password strength: <span className={strength.score <= 2 ? 'text-red-400' : strength.score <= 3 ? 'text-yellow-400' : 'text-green-400'}>{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password input */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 bg-dark-800 border rounded
                           text-white font-body placeholder-gray-500
                           focus:outline-none focus:ring-1
                           transition-all duration-200 ${
                             confirmPassword && password !== confirmPassword
                               ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                               : confirmPassword && password === confirmPassword
                               ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                               : 'border-dark-500 focus:border-neon-purple focus:ring-neon-purple'
                           }`}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1 text-xs text-green-400">Passwords match</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
              className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                       bg-transparent border-2 border-neon-purple text-neon-purple rounded
                       transition-all duration-300 ease-out
                       hover:bg-neon-purple hover:text-dark-900 hover:shadow-lg hover:shadow-neon-purple/30
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent 
                       disabled:hover:text-neon-purple disabled:hover:shadow-none
                       flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting Up...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Initialize System
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-500 font-body">
              This password will protect your network monitoring dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

