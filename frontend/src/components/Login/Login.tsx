import { useState, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(password);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
      setPassword('');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 grid-bg relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-neon-blue/30" />
        <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-neon-blue/30" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-neon-blue/30" />
        <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-neon-blue/30" />
        
        {/* Scan line effect */}
        <div className="absolute inset-0 scanline opacity-30" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-neon-blue/20 via-neon-purple/20 to-neon-pink/20 rounded-lg blur-xl opacity-50" />
        
        <div className="relative glass-dark rounded-lg shadow-2xl">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-neon-blue/20">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-neon-blue/10 border border-neon-blue/30">
                <svg 
                  viewBox="0 0 100 100" 
                  className="w-10 h-10 text-neon-blue"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {/* Star shape */}
                  <path d="M50 10 L58 38 L88 38 L64 56 L72 85 L50 68 L28 85 L36 56 L12 38 L42 38 Z" />
                  <circle cx="50" cy="50" r="12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-center text-neon-blue uppercase tracking-wider text-glow">
              Starlight
            </h1>
            <p className="text-center text-gray-400 mt-2 font-body text-sm">
              Network Monitor
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8">
            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 rounded bg-neon-pink/10 border border-neon-pink/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-neon-pink flex-shrink-0" />
                <p className="text-neon-pink text-sm font-body">{error}</p>
              </div>
            )}

            {/* Password input */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-display text-gray-400 uppercase tracking-wide mb-2">
                Admin Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-500 rounded
                           text-white font-body placeholder-gray-500
                           focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue
                           transition-all duration-200"
                  placeholder="Enter password"
                  autoFocus
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 px-6 font-display font-semibold uppercase tracking-wider
                       bg-transparent border-2 border-neon-blue text-neon-blue rounded
                       transition-all duration-300 ease-out
                       hover:bg-neon-blue hover:text-dark-900 hover:shadow-lg hover:shadow-neon-blue/30
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent 
                       disabled:hover:text-neon-blue disabled:hover:shadow-none
                       flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Access System
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-500 font-body">
              Secure access required for network monitoring
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
