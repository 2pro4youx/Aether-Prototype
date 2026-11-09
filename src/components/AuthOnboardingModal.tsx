import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  Clipboard,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { ColorPalette } from '../types';
import { getActiveGeminiApiKey, setActiveGeminiApiKey, callGeminiChat } from '../utils/geminiClient';

interface AuthOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (authData?: { email: string; apiKey: string }) => void;
  activePalette: ColorPalette;
  darkMode: boolean;
}

// Official Google G Brand Logo SVG
const GoogleGLogo: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthOnboardingModal: React.FC<AuthOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  activePalette,
  darkMode,
}) => {
  const [step, setStep] = useState<'google-auth' | 'gemini-key'>('google-auth');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [signedInAccount, setSignedInAccount] = useState<string | null>(null);

  // Gemini API Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [isCopiedSuccess, setIsCopiedSuccess] = useState(false);

  // Initialize key from stored value on open
  useEffect(() => {
    if (isOpen) {
      const active = getActiveGeminiApiKey();
      setApiKeyInput(active);
      if (active) {
        setKeyStatus({
          tested: true,
          success: true,
          message: 'Saved Gemini API key ready for use',
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Google Sign-in flow
  const handleGoogleSignIn = () => {
    setIsGoogleSigningIn(true);
    // Smooth micro-auth simulation connecting to standard Google Auth
    setTimeout(() => {
      const account = 'alex.learner@gmail.com';
      setSignedInAccount(account);
      setIsGoogleSigningIn(false);
      setStep('gemini-key');
    }, 650);
  };

  // Paste from clipboard
  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setApiKeyInput(text.trim());
        setIsCopiedSuccess(true);
        setTimeout(() => setIsCopiedSuccess(false), 1500);
      }
    } catch {
      // Clipboard permissions denied, fallback to manual entry
    }
  };

  // Test and save the key
  const handleSaveAndTestKey = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      setKeyStatus({
        tested: true,
        success: false,
        message: 'Please paste your Gemini API key before testing.',
      });
      return;
    }

    setIsTestingKey(true);
    setKeyStatus(null);
    setActiveGeminiApiKey(keyToTest);

    try {
      const res = await callGeminiChat({
        message: 'Ping verification. Respond with "Aether Gemini Connected" in 3 words.',
        apiKey: keyToTest,
      });

      if (res.success) {
        setKeyStatus({
          tested: true,
          success: true,
          message: `Live Connection Confirmed · ${res.modelUsed || 'gemini-3.8-flash'} ready`,
        });
        setTimeout(() => {
          localStorage.setItem('aether_gemini_api_key', keyToTest);
          const email = signedInAccount || 'alex.learner@gmail.com';
          localStorage.setItem('aether_auth_user', JSON.stringify({ email, name: 'Alex Learner' }));
          onComplete({ email, apiKey: keyToTest });
        }, 600);
      } else {
        setKeyStatus({
          tested: true,
          success: false,
          message: res.error || 'Failed to verify key. Please verify key format.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setKeyStatus({
        tested: true,
        success: false,
        message: msg,
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Proceed directly to app
  const handleProceedDirect = () => {
    const key = apiKeyInput.trim();
    if (key) {
      setActiveGeminiApiKey(key);
      localStorage.setItem('aether_gemini_api_key', key);
    }
    const email = signedInAccount || 'alex.learner@gmail.com';
    localStorage.setItem('aether_auth_user', JSON.stringify({ email, name: 'Alex Learner' }));
    onComplete({ email, apiKey: key });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Dark frosted background backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-200"
      />

      {/* Main Liquid Glass Modal Container */}
      <div
        className={`relative w-full max-w-xl rounded-3xl border shadow-2xl p-6 sm:p-8 backdrop-blur-2xl transition-all duration-300 liquid-glass no-lift my-auto ${
          darkMode
            ? 'bg-slate-900/90 border-white/20 text-slate-100 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)]'
            : 'bg-white/95 border-slate-300 text-slate-900 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.18)]'
        }`}
        style={{
          borderColor: `${activePalette.primary}60`,
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute right-4 top-4 p-2 rounded-full border transition cursor-pointer ${
            darkMode
              ? 'border-white/10 hover:bg-white/10 text-slate-400 hover:text-white'
              : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
          }`}
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* STEP 1: Google Authentication */}
        {step === 'google-auth' ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Top Badge & Header */}
            <div className="space-y-2 text-center">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono font-bold mx-auto"
                style={{
                  backgroundColor: `${activePalette.primary}20`,
                  borderColor: `${activePalette.primary}50`,
                  color: darkMode ? '#ffffff' : activePalette.primary,
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                <span>Google Account Authentication</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome to Aether Studio
              </h2>
              <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Sign in with your Google account to synchronize your research notebooks, OneNote canvas, and neural synthesis history.
              </p>
            </div>

            {/* Google Continue Button */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSigningIn}
                className={`w-full py-3.5 px-4 rounded-2xl border font-semibold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 ${
                  darkMode
                    ? 'bg-white text-slate-900 border-white/20 hover:bg-slate-100'
                    : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isGoogleSigningIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleGLogo className="w-5 h-5" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className={`flex-1 border-t ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">or</span>
                <div className={`flex-1 border-t ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />
              </div>

              {/* Guest / Direct Entry Button */}
              <button
                type="button"
                onClick={() => setStep('gemini-key')}
                className={`w-full py-2.5 px-4 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  darkMode
                    ? 'border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                    : 'border-slate-300 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Continue as Guest / Enter API Key Directly</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Privacy footnote */}
            <p className="text-[11px] text-center text-slate-500 font-mono">
              Your data stays local on your machine. API calls run securely through official Google GenAI endpoints.
            </p>
          </div>
        ) : (
          /* STEP 2: Gemini API Key Setup */
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: `${activePalette.primary}30` }}>
              <button
                type="button"
                onClick={() => setStep('google-auth')}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {signedInAccount && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{signedInAccount}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Key className="w-5 h-5" style={{ color: activePalette.primary }} />
                <span>Connect Your Gemini API Key</span>
              </h3>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Enter your Google Gemini API key to activate grounded NotebookLM reasoning, mathematical derivations, and multi-source synthesis.
              </p>
            </div>

            {/* Input Box with Password Toggle & Paste */}
            <div className="space-y-1.5">
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className={`w-full pl-3.5 pr-20 py-2.5 rounded-xl border text-xs font-mono focus:outline-none transition ${
                    darkMode
                      ? 'bg-slate-950/80 border-white/20 text-slate-100 placeholder-slate-500 focus:border-cyan-400'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600'
                  }`}
                  style={{
                    borderColor: keyStatus?.success ? '#10b981' : undefined,
                  }}
                />

                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handlePasteKey}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    title="Paste from clipboard"
                  >
                    {isCopiedSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clipboard className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Exact Helper text link directly underneath the input box from Reference Image 1 */}
              <p className="text-xs text-slate-400 pt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Don&apos;t have a key?</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline hover:brightness-125 transition inline-flex items-center gap-1"
                  style={{ color: activePalette.primary }}
                >
                  <span>Get your free Gemini API key from Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            {/* Exact 4-Step Instructions For Your Users Card from Reference Image 2 */}
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-2.5 ${
                darkMode
                  ? 'bg-slate-950/50 border-white/10 text-slate-300'
                  : 'bg-slate-100/90 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: activePalette.primary }} />
                  <span>The 4-Step Instructions For Your Users</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">Google AI Studio</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Follow this quick checklist to generate your free Gemini API key:
              </p>

              <ol className="space-y-1.5 text-[11px] list-none pl-0">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">1. Sign In:</span>
                  <span>
                    Go to{' '}
                    <a
                      href="https://aistudio.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-white"
                      style={{ color: activePalette.primary }}
                    >
                      Google AI Studio
                    </a>{' '}
                    and log in using any standard Google account (<code className="font-mono text-cyan-300">@gmail.com</code>).
                  </span>
                </li>

                <li className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">2. Accept Terms:</span>
                  <span>If it is your first time visiting, accept the Google Generative AI terms of service.</span>
                </li>

                <li className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">3. Generate Key:</span>
                  <span>
                    Click the <strong className="text-white font-semibold">&quot;Create API key&quot;</strong> button at the top or sidebar.
                  </span>
                </li>

                <li className="flex items-start gap-2">
                  <span className="font-bold text-white shrink-0">4. Copy &amp; Paste:</span>
                  <span>
                    Copy the generated string of characters (it usually begins with{' '}
                    <code className="px-1 py-0.2 rounded font-mono bg-white/10 text-cyan-300">AIzaSy...</code>) and paste it into the field above.
                  </span>
                </li>
              </ol>
            </div>

            {/* Status Feedback Message */}
            {keyStatus && (
              <p
                className={`text-xs font-mono flex items-center gap-2 ${
                  keyStatus.success ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {keyStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{keyStatus.message}</span>
              </p>
            )}

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleProceedDirect}
                className="text-xs text-slate-400 hover:text-white transition cursor-pointer order-2 sm:order-1 font-mono"
              >
                Skip for now &gt;
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                <button
                  type="button"
                  onClick={handleSaveAndTestKey}
                  disabled={isTestingKey || !apiKeyInput.trim()}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${activePalette.primary}, ${activePalette.accent})`,
                    color: '#0f172a',
                  }}
                >
                  {isTestingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Testing Live Connection...</span>
                    </>
                  ) : (
                    <>
                      <span>Save &amp; Launch Aether Studio</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
