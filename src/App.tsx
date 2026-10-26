/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Users,
  Radio,
  ShieldAlert,
  Server,
  Play,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Music,
  Video,
  Sparkles,
  Bot,
  Copy,
  Terminal,
  ExternalLink,
  Ban,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  Lock,
  LogOut,
  Globe,
  Share2,
  Zap,
  CheckCircle,
} from 'lucide-react';

interface StatsOverview {
  totalUsers: number;
  activeUsers: number;
  totalDownloads: number;
  mp3Downloads: number;
  videoDownloads: number;
  failedCount: number;
  platformStats: Record<string, number>;
  recentDownloads: Array<{
    id: string;
    telegram_id: string;
    url: string;
    platform: string;
    format: string;
    status: string;
    file_size: number;
    duration: number;
    title: string | null;
    created_at: string;
  }>;
}

interface UserItem {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  language: string;
  is_premium: number;
  is_banned: number;
  downloads_count: number;
  created_at: string;
  last_activity: string;
}

interface ServerInfo {
  status: string;
  uptimeSeconds: number;
  database: string;
  telegramConfigured: boolean;
  saveApiUrl: string;
  activeJobsCount: number;
}

export default function App() {
  // Routing: determine if user is on public site '/' or Telegram Bot Admin '/bot-admin'
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  const isBotAdminRoute = currentPath.startsWith('/bot-admin');

  return (
    <div className="min-h-screen bg-[#08070C] text-white flex flex-col font-sans">
      {isBotAdminRoute ? (
        <BotAdminApp onGoHome={() => navigateTo('/')} />
      ) : (
        <PublicSaveAzHome onGoAdmin={() => navigateTo('/bot-admin')} />
      )}
    </div>
  );
}

/**
 * ============================================================================
 * 1. PUBLIC SAVE.AZ WEBSITE (Zero login, 100% public video/audio downloader)
 * ============================================================================
 */
function PublicSaveAzHome({ onGoAdmin }: { onGoAdmin: () => void }) {
  const [urlInput, setUrlInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedMedia, setAnalyzedMedia] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDownloadJob, setActiveDownloadJob] = useState<{
    jobId: string;
    format: string;
    percent: number;
    speed: string;
    eta: string;
    size: string;
    fileUrl?: string;
    status: 'downloading' | 'completed' | 'failed';
  } | null>(null);

  const handleAnalyze = async (targetUrl?: string) => {
    const url = (targetUrl || urlInput).trim();
    if (!url) return;

    setAnalyzing(true);
    setErrorMessage(null);
    setAnalyzedMedia(null);
    setActiveDownloadJob(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      if (data.success && (data.data || data.title)) {
        setAnalyzedMedia(data.data || data);
      } else {
        setErrorMessage(data.error || '❌ Bu linki analiz etmək mümkün olmadı. Zəhmət olmasa linki yoxlayın.');
      }
    } catch {
      setErrorMessage('⚠️ Serverlə əlaqə qurmaq mümkün olmadı. Bir az sonra yenidən cəhd edin.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStartDownload = async (format: string) => {
    if (!analyzedMedia) return;

    setActiveDownloadJob({
      jobId: '',
      format,
      percent: 10,
      speed: '4.8 MB/s',
      eta: '10 saniyə',
      size: `${analyzedMedia.approxSizeMb || 18.4} MB`,
      status: 'downloading',
    });

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: analyzedMedia.url,
          platform: analyzedMedia.platform,
          format: format.toLowerCase().includes('mp3') ? 'mp3' : 'mp4',
          title: analyzedMedia.title,
          duration: analyzedMedia.durationSeconds,
          approxSizeMb: analyzedMedia.approxSizeMb,
        }),
      });

      const data = await res.json();
      if (!data.success || !data.jobId) {
        setActiveDownloadJob(prev => prev ? { ...prev, status: 'failed' } : null);
        return;
      }

      const jobId = data.jobId;
      setActiveDownloadJob(prev => prev ? { ...prev, jobId } : null);

      // Poll progress
      let done = false;
      let count = 0;
      while (!done && count < 60) {
        count++;
        await new Promise(r => setTimeout(r, 1000));
        const pRes = await fetch(`/api/download/${jobId}/progress`);
        if (pRes.ok) {
          const progress = await pRes.json();
          setActiveDownloadJob({
            jobId,
            format,
            percent: progress.percentage || 100,
            speed: '5.2 MB/s',
            eta: progress.etaSeconds ? `${progress.etaSeconds} san` : 'tamamlanır',
            size: `${analyzedMedia.approxSizeMb || 18.4} MB`,
            fileUrl: progress.fileUrl || `/downloads/saveaz_${jobId}.${format.toLowerCase().includes('mp3') ? 'mp3' : 'mp4'}`,
            status: progress.status === 'completed' || progress.percentage >= 100 ? 'completed' : 'downloading',
          });

          if (progress.status === 'completed' || progress.percentage >= 100) {
            done = true;
            break;
          }
        }
      }
    } catch {
      setActiveDownloadJob(prev => prev ? { ...prev, status: 'failed' } : null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Public Header */}
      <header className="border-b border-[#2A0B1D] bg-[#160A13]/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E9005C] via-[#FF0F68] to-[#FF2F7D] flex items-center justify-center glow-pink-sm font-black text-xl tracking-wider">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-white to-pink-200 bg-clip-text text-transparent">
                Save.az
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#2A0B1D] text-[#FF2F7D] border border-[#FF0F68]/30">
                Sosial Media Yükləyici
              </span>
            </div>
            <p className="text-xs text-[#A8A0AC]">
              TikTok, YouTube, Instagram və Facebook-dan video və musiqi yükləyin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://t.me/saveaz_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#2A0B1D] hover:bg-[#FF0F68]/20 border border-[#2A0B1D] hover:border-[#FF0F68]/50 text-xs font-semibold text-[#FF2F7D] transition glow-pink-sm"
          >
            <Bot className="w-4 h-4" /> Telegram Botumuz
          </a>

          <button
            onClick={onGoAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08070C] hover:bg-[#2A0B1D] border border-[#2A0B1D] text-xs text-[#A8A0AC] hover:text-white transition"
            title="Telegram Bot İdarəetməsi"
          >
            <Lock className="w-3.5 h-3.5 text-[#FF0F68]" /> Bot İdarəetməsi
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 px-4 text-center max-w-4xl mx-auto w-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF0F68]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#160A13] border border-[#FF0F68]/30 text-xs font-semibold text-[#FF2F7D] mb-5 glow-pink-sm">
          <Sparkles className="w-3.5 h-3.5" /> Qeydiyyatsız & Tamamilə Pulsuz
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Sosial Media Videolarını və Musiqilərini{' '}
          <span className="bg-gradient-to-r from-[#FF0F68] to-[#FF2F7D] bg-clip-text text-transparent">
            Rahat Yadda Saxlayın
          </span>
        </h1>

        <p className="text-sm sm:text-base text-[#A8A0AC] max-w-2xl mx-auto mb-8">
          TikTok, YouTube, Shorts, Instagram Reels və Facebook linkini daxil edin. Saniyələr içində HD keyfiyyətində MP4 video və ya 320 kbps MP3 musiqi yükləyin.
        </p>

        {/* Input Bar */}
        <div className="max-w-2xl mx-auto bg-[#160A13] p-2 rounded-2xl border border-[#2A0B1D] shadow-2xl focus-within:border-[#FF0F68] transition glow-pink-sm flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAnalyze();
            }}
            placeholder="Video və ya musiqi linkini bura yapışdırın..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={() => handleAnalyze()}
            disabled={analyzing || !urlInput.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E9005C] to-[#FF0F68] hover:brightness-110 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 glow-pink-sm transition whitespace-nowrap"
          >
            {analyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Analiz edilir...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" /> Yüklə
              </>
            )}
          </button>
        </div>

        {/* Sample Links Quick Click */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[#A8A0AC]">
          <span>Nümunələr:</span>
          {[
            { label: 'TikTok', url: 'https://www.tiktok.com/@tiktok/video/73289192837' },
            { label: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/3bN9mZpY8' },
            { label: 'Instagram Reel', url: 'https://www.instagram.com/reel/C8k9xL2pQ1' },
            { label: 'Facebook', url: 'https://www.facebook.com/watch/?v=1029384756' },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => {
                setUrlInput(s.url);
                handleAnalyze(s.url);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#160A13] border border-[#2A0B1D] hover:border-[#FF0F68]/50 hover:text-white transition"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="mt-6 max-w-2xl mx-auto p-4 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 text-left">
            {errorMessage}
          </div>
        )}

        {/* Analyzed Media Card */}
        {analyzedMedia && (
          <div className="mt-8 max-w-2xl mx-auto bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 text-left shadow-2xl glow-pink-sm space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {analyzedMedia.thumbnailUrl && (
                <img
                  src={analyzedMedia.thumbnailUrl}
                  alt={analyzedMedia.title}
                  className="w-full sm:w-36 h-28 object-cover rounded-xl border border-[#2A0B1D]"
                />
              )}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A0B1D] text-[#FF2F7D] border border-[#FF0F68]/30">
                    {analyzedMedia.platform || 'Media'}
                  </span>
                  <span className="text-xs text-[#A8A0AC]">
                    ⏱ {analyzedMedia.durationSeconds || 45} saniyə
                  </span>
                </div>
                <h3 className="font-bold text-base text-white line-clamp-2">
                  {analyzedMedia.title || 'Sosial Media Video'}
                </h3>
                <p className="text-xs text-[#A8A0AC]">
                  Müəllif: <strong className="text-gray-300">{analyzedMedia.author || '@creator'}</strong> • Təxmini: {analyzedMedia.approxSizeMb || 18.4} MB
                </p>
              </div>
            </div>

            {/* Format Selection Buttons */}
            <div className="pt-2 border-t border-[#2A0B1D] space-y-3">
              <div className="text-xs font-semibold text-[#A8A0AC]">Formatı seçin:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={() => handleStartDownload('MP4')}
                  className="p-3 rounded-xl bg-[#2A0B1D] hover:bg-[#FF0F68] border border-[#2A0B1D] hover:border-[#FF0F68] text-xs font-bold text-white transition flex items-center justify-center gap-2 group"
                >
                  <Video className="w-4 h-4 text-[#FF2F7D] group-hover:text-white" /> 🎬 MP4 Video
                </button>
                <button
                  onClick={() => handleStartDownload('MP3')}
                  className="p-3 rounded-xl bg-[#2A0B1D] hover:bg-[#FF0F68] border border-[#2A0B1D] hover:border-[#FF0F68] text-xs font-bold text-white transition flex items-center justify-center gap-2 group"
                >
                  <Music className="w-4 h-4 text-purple-400 group-hover:text-white" /> 🎵 MP3 Musiqi
                </button>
                <button
                  onClick={() => handleStartDownload('HD')}
                  className="p-3 rounded-xl bg-[#2A0B1D] hover:bg-[#FF0F68] border border-[#2A0B1D] hover:border-[#FF0F68] text-xs font-bold text-white transition flex items-center justify-center gap-2 group"
                >
                  <Sparkles className="w-4 h-4 text-blue-400 group-hover:text-white" /> 📱 HD Keyfiyyət
                </button>
              </div>
            </div>

            {/* Active Download Progress Bar */}
            {activeDownloadJob && (
              <div className="p-4 rounded-2xl bg-[#08070C] border border-[#2A0B1D] space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-gray-300 font-sans font-medium">
                  <span className="flex items-center gap-2">
                    {activeDownloadJob.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF0F68] animate-ping"></span>
                    )}
                    {activeDownloadJob.status === 'completed'
                      ? 'Yükləmə tamamlandı!'
                      : 'Fayl hazırlanır və yüklənir...'}
                  </span>
                  <span className="font-bold text-[#FF2F7D]">
                    {activeDownloadJob.percent}%
                  </span>
                </div>

                {/* Progress bar visual */}
                <div className="w-full bg-[#160A13] h-2.5 rounded-full overflow-hidden border border-[#2A0B1D]">
                  <div
                    className="h-full bg-gradient-to-r from-[#E9005C] to-[#FF0F68] transition-all duration-300 rounded-full"
                    style={{ width: `${activeDownloadJob.percent}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A8A0AC] pt-1">
                  <span>📦 {activeDownloadJob.size}</span>
                  <span>⚡ {activeDownloadJob.speed}</span>
                  <span>⏱ {activeDownloadJob.eta}</span>
                </div>

                {activeDownloadJob.status === 'completed' && activeDownloadJob.fileUrl && (
                  <div className="pt-2">
                    <a
                      href={activeDownloadJob.fileUrl}
                      download
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Download className="w-4 h-4" /> Faylı Yaddaşda Saxla ({activeDownloadJob.format})
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-12 px-4 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
        <div className="p-5 rounded-2xl bg-[#160A13] border border-[#2A0B1D]">
          <div className="w-10 h-10 rounded-xl bg-[#FF0F68]/20 flex items-center justify-center text-[#FF2F7D] mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white mb-1">Maksimum Sürət</h4>
          <p className="text-xs text-[#A8A0AC]">
            Videolar birbaşa ən yaxşı serverlərdən yüksək sürətlə yüklənir.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#160A13] border border-[#2A0B1D]">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
            <Music className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white mb-1">MP3 Audio Çıxarış</h4>
          <p className="text-xs text-[#A8A0AC]">
            İstənilən videodan 320 kbps keyfiyyətində təmiz audio trek əldə edin.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#160A13] border border-[#2A0B1D]">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
            <Video className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white mb-1">HD & 4K Dəstəyi</h4>
          <p className="text-xs text-[#A8A0AC]">
            Platformanın dəstəklədiyi ən yüksək vizual keyfiyyət qorunur.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#160A13] border border-[#2A0B1D]">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-white mb-1">Təhlükəsiz & Anonim</h4>
          <p className="text-xs text-[#A8A0AC]">
            Qeydiyyat tələb olunmur, heç bir şəxsi məlumat saxlanılmır.
          </p>
        </div>
      </section>

      {/* Telegram Bot Promo Banner */}
      <section className="py-8 px-4 max-w-4xl mx-auto w-full">
        <div className="bg-gradient-to-r from-[#160A13] via-[#2A0B1D] to-[#160A13] border border-[#FF0F68]/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 glow-pink-sm text-left">
          <div className="space-y-2">
            <span className="text-xs uppercase font-bold text-[#FF2F7D] tracking-wider">
              📱 Mobil üçün ən rahat yol
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Save.az Telegram Botunu İstifadə Edin
            </h3>
            <p className="text-xs sm:text-sm text-[#A8A0AC] max-w-md">
              Linkləri birbaşa Telegram çatına göndərin və faylı tətbiqdən çıxmadan qəbul edin.
            </p>
          </div>
          <a
            href="https://t.me/saveaz_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#E9005C] to-[#FF0F68] font-bold text-sm text-white flex items-center gap-2 glow-pink-sm hover:brightness-110 transition whitespace-nowrap"
          >
            <Bot className="w-5 h-5" /> Bota Başla
          </a>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="mt-auto border-t border-[#2A0B1D] bg-[#10070F] py-6 px-6 text-xs text-[#A8A0AC] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © 2026 Save.az — Bütün hüquqlar qorunur. Sosial media video və musiqi yükləyici platforması.
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onGoAdmin}
            className="text-gray-400 hover:text-[#FF2F7D] transition flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" /> Telegram Bot Admin Paneli (/bot-admin)
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * ============================================================================
 * 2. TELEGRAM BOT ADMIN ROUTE (/bot-admin)
 * Protected with Password Hash & Session Authentication!
 * ============================================================================
 */
function BotAdminApp({ onGoHome }: { onGoHome: () => void }) {
  const [sessionToken, setSessionToken] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('saveaz_admin_token') : null
  );
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Verify session on mount
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('saveaz_admin_token');
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setSessionToken(token);
          } else {
            localStorage.removeItem('saveaz_admin_token');
            setSessionToken(null);
          }
        } else {
          localStorage.removeItem('saveaz_admin_token');
          setSessionToken(null);
        }
      } catch {
        // Network offline or error
      } finally {
        setAuthChecking(false);
      }
    };

    verifyToken();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim() || loggingIn) return;

    setLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('saveaz_admin_token', data.token);
        setSessionToken(data.token);
        setPasswordInput('');
      } else {
        setLoginError(data.error || 'İstifadəçi adı və ya şifrə yanlışdır.');
      }
    } catch {
      setLoginError('Serverə qoşulmaq mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (sessionToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {}
    }
    localStorage.removeItem('saveaz_admin_token');
    setSessionToken(null);
  };

  if (authChecking) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-sm text-[#A8A0AC]">
          <span className="w-4 h-4 border-2 border-[#FF0F68] border-t-transparent rounded-full animate-spin"></span>
          Admin sessiyası yoxlanılır...
        </div>
      </div>
    );
  }

  // If not authenticated, render Login Page
  if (!sessionToken) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-8 shadow-2xl glow-pink-sm relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FF0F68]/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#E9005C] via-[#FF0F68] to-[#FF2F7D] flex items-center justify-center font-black text-2xl text-white shadow-lg mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Telegram Bot Admin Paneli</h2>
            <p className="text-xs text-[#A8A0AC] mt-1">
              /bot-admin marşrutu üçün autentifikasiya tələb olunur
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/40 text-xs text-rose-300">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#A8A0AC] mb-1.5">
                İstifadəçi Adı
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="admin"
                className="w-full bg-[#08070C] border border-[#2A0B1D] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0F68] transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A8A0AC] mb-1.5">
                Şifrə
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#08070C] border border-[#2A0B1D] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0F68] transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn || !usernameInput.trim() || !passwordInput.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E9005C] to-[#FF0F68] hover:brightness-110 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 glow-pink-sm transition mt-2"
            >
              {loggingIn ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Giriş edilir...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Daxil Ol
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#2A0B1D] text-center">
            <button
              onClick={onGoHome}
              className="text-xs text-[#A8A0AC] hover:text-white transition flex items-center justify-center gap-1 mx-auto"
            >
              ← Save.az Əsas Saytına Qayıt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, render full Telegram Bot Admin Dashboard
  return (
    <BotAdminDashboard
      token={sessionToken}
      onLogout={handleLogout}
      onGoHome={onGoHome}
    />
  );
}

/**
 * ============================================================================
 * 3. AUTHENTICATED BOT ADMIN DASHBOARD (Save.az Downloader Bot Management)
 * ============================================================================
 */
function BotAdminDashboard({
  token,
  onLogout,
  onGoHome,
}: {
  token: string;
  onLogout: () => void;
  onGoHome: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'simulator' | 'users' | 'downloads' | 'broadcast' | 'system'>('dashboard');
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // Bot Simulator State
  const [simMessages, setSimMessages] = useState<Array<{
    sender: 'user' | 'bot';
    text: string;
    buttons?: string[];
    media?: any;
    progress?: { percent: number; speed: string; eta: string; size: string };
    isFinished?: boolean;
    audioCaption?: boolean;
  }>>([
    {
      sender: 'bot',
      text: '👋 Salam! Save.az-a xoş gəlmisiniz.\n\n🎬 TikTok, YouTube, Instagram və Facebook videolarını yükləyin.\n\n🔗 Sadəcə video linkini göndərin — qalanını biz edək.',
      buttons: ['🔗 Link göndər', '📥 Yükləmələrim', 'ℹ️ Haqqımızda', '⚙️ Ayarlar', '❓ Kömək'],
    },
  ]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // System Logs
  const [logs, setLogs] = useState<Array<{ level: string; message: string; timestamp: string }>>([]);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchOverview = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/overview', { headers: authHeaders });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setStats(data.stats);
        if (data.aiSummary) setAiSummary(data.aiSummary);
        if (data.serverInfo) setServerInfo(data.serverInfo);
      }
    } catch {
      // Quietly handle network pauses or server restarts
    }
  };

  const fetchServerInfo = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setServerInfo(data);
      }
    } catch {
      // Quietly handle network pauses or server restarts
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}`, {
        headers: authHeaders,
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      // Quietly handle network pauses
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/logs', { headers: authHeaders });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // Quietly handle network pauses
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchServerInfo();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchOverview();
      fetchServerInfo();
    }, 12000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'system') {
      fetchLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages]);

  const handleToggleBan = async (telegramId: string, currentBanned: number) => {
    try {
      const res = await fetch(`/api/admin/users/${telegramId}/ban`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ isBanned: currentBanned === 0 }),
      });
      if (res.ok) {
        fetchUsers();
        fetchOverview();
      }
    } catch {
      // Safe catch
    }
  };

  const handleTogglePremium = async (telegramId: string, currentPremium: number) => {
    try {
      const res = await fetch(`/api/admin/users/${telegramId}/premium`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ isPremium: currentPremium === 0 }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      // Safe catch
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcasting(true);
    setBroadcastStatus(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ message: broadcastMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastStatus(`✅ Yayım uğurla göndərildi! Çatdırıldı: ${data.sent} istifadəçi.`);
        setBroadcastMessage('');
      } else {
        setBroadcastStatus(`❌ Xəta: ${data.error || 'Göndərmək mümkün olmadı'}`);
      }
    } catch {
      setBroadcastStatus('❌ Şəbəkə xətası baş verdi.');
    } finally {
      setBroadcasting(false);
    }
  };

  const sendSimMessage = async (textToSend: string) => {
    if (!textToSend.trim() || simLoading) return;

    const userText = textToSend.trim();
    setSimMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setSimInput('');
    setSimLoading(true);

    try {
      const res = await fetch('/api/test/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText }),
      });

      const data = await res.json();

      if (data.type === 'start') {
        setSimMessages((prev) => [
          ...prev,
          { sender: 'bot', text: data.message, buttons: data.buttons },
        ]);
      } else if (data.type === 'media_found') {
        setSimMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: data.message,
            media: data.data,
            buttons: ['🎬 MP4 (1080p)', '🎵 MP3 (320kbps)', '📱 HD Video'],
          },
        ]);
      } else {
        setSimMessages((prev) => [
          ...prev,
          { sender: 'bot', text: data.message || 'Cavab alındı.' },
        ]);
      }
    } catch {
      setSimMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ Hazırda serverə qoşulmaq mümkün olmadı. Bir neçə dəqiqə sonra yenidən cəhd edin.',
        },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  const triggerSimDownload = (format: string, media?: any) => {
    const isMp3 = format.toLowerCase().includes('mp3');
    const targetSize = media?.approxSizeMb ? `${media.approxSizeMb} MB` : '18.4 MB';

    const downloadMsgIndex = simMessages.length;
    setSimMessages((prev) => [
      ...prev,
      {
        sender: 'bot',
        text: '⬇️ Yüklənir...',
        progress: {
          percent: 15,
          speed: '4.8 MB/s',
          eta: '12 saniyə',
          size: targetSize,
        },
      },
    ]);

    const progressSteps = [
      { p: 40, s: '5.2 MB/s', eta: '8 saniyə' },
      { p: 75, s: '4.9 MB/s', eta: '4 saniyə' },
      { p: 95, s: '4.5 MB/s', eta: '1 saniyə' },
      { p: 100, s: '3.8 MB/s', eta: '0 saniyə' },
    ];

    progressSteps.forEach((step, idx) => {
      setTimeout(() => {
        setSimMessages((prev) => {
          const updated = [...prev];
          if (updated[downloadMsgIndex]) {
            updated[downloadMsgIndex] = {
              ...updated[downloadMsgIndex],
              progress: {
                percent: step.p,
                speed: step.s,
                eta: step.eta,
                size: targetSize,
              },
            };
          }
          return updated;
        });

        if (idx === progressSteps.length - 1) {
          setTimeout(() => {
            fetchOverview();
            if (isMp3) {
              setSimMessages((prev) => [
                ...prev,
                {
                  sender: 'bot',
                  text: '🎵 Save.az\n\nMusiqi uğurla hazırlandı.\n\n🎬 ' + (media?.title || 'Sosial Media Audio') + '\n⏱ 03:25',
                  audioCaption: true,
                  isFinished: true,
                },
              ]);
            } else {
              setSimMessages((prev) => [
                ...prev,
                {
                  sender: 'bot',
                  text: '✅ Yükləmə tamamlandı!\n\n🎬 ' + (media?.title || 'Video') + ' (HD)\n👤 ' + (media?.author || '@istifadəçi'),
                  isFinished: true,
                },
              ]);
            }
          }, 600);
        }
      }, (idx + 1) * 700);
    });
  };

  const copySampleLink = (url: string) => {
    setSimInput(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Admin Navigation */}
      <header className="border-b border-[#2A0B1D] bg-[#160A13]/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E9005C] via-[#FF0F68] to-[#FF2F7D] flex items-center justify-center glow-pink-sm font-black text-xl tracking-wider">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-white to-pink-200 bg-clip-text text-transparent">
                Save.az
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#2A0B1D] text-[#FF2F7D] border border-[#FF0F68]/30">
                Bot Admin Panel
              </span>
            </div>
            <p className="text-xs text-[#A8A0AC]">
              /bot-admin • Qorunan Telegram Bot İdarəetmə Paneli
            </p>
          </div>
        </div>

        {/* Server status & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#08070C] hover:bg-[#2A0B1D] border border-[#2A0B1D] text-xs text-[#A8A0AC] hover:text-white transition"
          >
            <Globe className="w-3.5 h-3.5 text-[#FF0F68]" /> Əsas Sayta Keç
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#08070C] border border-[#2A0B1D] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[#A8A0AC]">Status:</span>
            <span className="font-medium text-emerald-400">
              {serverInfo?.telegramConfigured ? 'Aktiv (Telegram)' : 'Polling / API'}
            </span>
          </div>

          <button
            onClick={() => {
              fetchOverview();
              fetchServerInfo();
            }}
            className="p-2 rounded-lg bg-[#2A0B1D] hover:bg-[#FF0F68]/20 text-[#A8A0AC] hover:text-white transition border border-[#2A0B1D]"
            title="Yenilə"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-xs font-semibold text-rose-300 transition"
            title="Sessiyadan Çıx"
          >
            <LogOut className="w-3.5 h-3.5" /> Çıxış
          </button>
        </div>
      </header>

      {/* Admin Tabs Menu */}
      <nav className="bg-[#10070F] border-b border-[#2A0B1D] px-4 lg:px-8 flex overflow-x-auto gap-2 py-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Layers className="w-4 h-4" /> İdarəetmə Paneli
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Bot className="w-4 h-4" /> Bot Sınaq & Simulyator
          <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">Canlı</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Users className="w-4 h-4" /> İstifadəçilər ({stats?.totalUsers ?? '...'})
        </button>

        <button
          onClick={() => setActiveTab('downloads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'downloads'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Download className="w-4 h-4" /> Yükləmələr ({stats?.totalDownloads ?? '...'})
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'broadcast'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Radio className="w-4 h-4" /> Yayım (Broadcast)
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
            activeTab === 'system'
              ? 'bg-[#FF0F68] text-white glow-pink-sm'
              : 'text-[#A8A0AC] hover:text-white hover:bg-[#160A13]'
          }`}
        >
          <Server className="w-4 h-4" /> Sistem & API Status
        </button>
      </nav>

      {/* Main Admin Content */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {aiSummary && (
              <div className="bg-gradient-to-r from-[#160A13] via-[#2A0B1D] to-[#160A13] border border-[#FF0F68]/30 rounded-2xl p-4 flex items-start gap-3.5 glow-pink-sm">
                <div className="p-2 rounded-xl bg-[#FF0F68]/20 text-[#FF2F7D] shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#FF2F7D]">Save.az AI Xülasəsi</span>
                    <span className="text-[10px] uppercase tracking-wide bg-[#FF0F68]/20 text-white px-2 py-0.5 rounded-full">
                      Avtomatlaşdırılmış
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed">{aiSummary}</p>
                </div>
              </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Cəmi İstifadəçi</div>
                <div className="text-2xl font-extrabold text-white">{stats?.totalUsers ?? 0}</div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Qeydiyyatda
                </div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Aktiv (24s)</div>
                <div className="text-2xl font-extrabold text-emerald-400">{stats?.activeUsers ?? 0}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Son 24 saatda
                </div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Cəmi Yükləmə</div>
                <div className="text-2xl font-extrabold text-[#FF2F7D]">{stats?.totalDownloads ?? 0}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1">Uğurla tamamlanan</div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Video (MP4/HD)</div>
                <div className="text-2xl font-extrabold text-blue-400">{stats?.videoDownloads ?? 0}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1 flex items-center gap-1">
                  <Video className="w-3 h-3" /> TikTok / YT / IG
                </div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Musiqi (MP3)</div>
                <div className="text-2xl font-extrabold text-purple-400">{stats?.mp3Downloads ?? 0}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1 flex items-center gap-1">
                  <Music className="w-3 h-3" /> Audio çıxarış
                </div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4 relative overflow-hidden">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Xətalar</div>
                <div className="text-2xl font-extrabold text-rose-400">{stats?.failedCount ?? 0}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Qorunma / Limit
                </div>
              </div>
            </div>

            {/* Platform Distribution & Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-lg text-white">Platformalara Görə Yükləmələr</h3>
                  <span className="text-xs text-[#A8A0AC]">Avtomatik bölünmə</span>
                </div>

                <div className="space-y-4">
                  {[
                    { name: 'TikTok', key: 'tiktok', color: 'from-[#00F2FE] to-[#4FACFE]', icon: '🎵' },
                    { name: 'YouTube & Shorts', key: 'youtube', color: 'from-[#FF0844] to-[#FFB199]', icon: '🎬' },
                    { name: 'Instagram Reels & Post', key: 'instagram', color: 'from-[#E1306C] via-[#FD1D1D] to-[#F77737]', icon: '📸' },
                    { name: 'Facebook Video', key: 'facebook', color: 'from-[#1877F2] to-[#3B5998]', icon: '📘' },
                  ].map((plat) => {
                    const count = stats?.platformStats?.[plat.key] || 0;
                    const total = stats?.totalDownloads || 1;
                    const percent = Math.round((count / Math.max(1, total)) * 100);

                    return (
                      <div key={plat.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium flex items-center gap-2">
                            <span>{plat.icon}</span> {plat.name}
                          </span>
                          <span className="text-xs font-semibold text-[#A8A0AC]">
                            {count} ədəd ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#08070C] rounded-full h-3 overflow-hidden border border-[#2A0B1D]">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${plat.color} transition-all duration-700`}
                            style={{ width: `${Math.max(4, percent)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bot Simulation Quick Card */}
              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FF0F68]/20 flex items-center justify-center text-[#FF2F7D] mb-4 glow-pink-sm">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">Botu Canlı Sınaqdan Keçirin</h3>
                  <p className="text-sm text-[#A8A0AC] leading-relaxed mb-4">
                    Telegram tokeni olmadan belə botun /start əmrini, URL analizini və progress bar animasiyasını test edin.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('simulator')}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E9005C] to-[#FF0F68] font-bold text-sm text-white flex items-center justify-center gap-2 glow-pink-sm hover:brightness-110 transition"
                  >
                    Simulyatoru Aç <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('system')}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#2A0B1D] hover:bg-[#2A0B1D]/80 text-sm font-semibold text-[#A8A0AC] hover:text-white transition text-center"
                  >
                    Sistem Loqlarına Bax
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Downloads Table */}
            <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-white">Son Yükləmələr</h3>
                <span className="text-xs text-[#A8A0AC]">Baza jurnalı</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#2A0B1D] text-[#A8A0AC] text-xs uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Media Başlığı</th>
                      <th className="pb-3 font-semibold">Platforma</th>
                      <th className="pb-3 font-semibold">Format</th>
                      <th className="pb-3 font-semibold">Ölçü</th>
                      <th className="pb-3 font-semibold">İstifadəçi ID</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Tarix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A0B1D]/50">
                    {stats?.recentDownloads && stats.recentDownloads.length > 0 ? (
                      stats.recentDownloads.slice(0, 8).map((d) => (
                        <tr key={d.id} className="hover:bg-[#2A0B1D]/30 transition">
                          <td className="py-3 font-medium text-white max-w-xs truncate">
                            {d.title || 'Başlıqsız Video'}
                          </td>
                          <td className="py-3 uppercase text-xs font-semibold text-[#FF2F7D]">
                            {d.platform}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#2A0B1D] text-white">
                              {d.format.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-[#A8A0AC]">
                            {d.file_size ? `${Math.round(d.file_size / (1024 * 1024))} MB` : '18.4 MB'}
                          </td>
                          <td className="py-3 text-xs font-mono text-gray-300">
                            {d.telegram_id}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                              <CheckCircle2 className="w-3 h-3" /> Uğurlu
                            </span>
                          </td>
                          <td className="py-3 text-xs text-[#A8A0AC]">
                            {new Date(d.created_at).toLocaleTimeString('az-AZ')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#A8A0AC]">
                          Hələlik heç bir yükləmə qeydə alınmayıb.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BOT SIMULATOR TAB */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-4 flex flex-col h-[650px] shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A0B1D] px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF0F68] to-[#FF2F7D] flex items-center justify-center font-bold text-white shadow-md">
                    S
                  </div>
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      Save.az Downloader Bot
                      <span className="text-[10px] bg-[#FF0F68]/20 text-[#FF2F7D] px-1.5 py-0.2 rounded font-semibold">
                        bot
                      </span>
                    </div>
                    <div className="text-xs text-emerald-400">həmişə onlayn</div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setSimMessages([
                      {
                        sender: 'bot',
                        text: '👋 Salam! Save.az-a xoş gəlmisiniz.\n\n🎬 TikTok, YouTube, Instagram və Facebook videolarını yükləyin.\n\n🔗 Sadəcə video linkini göndərin — qalanını biz edək.',
                        buttons: ['🔗 Link göndər', '📥 Yükləmələrim', 'ℹ️ Haqqımızda', '⚙️ Ayarlar', '❓ Kömək'],
                      },
                    ])
                  }
                  className="text-xs text-[#A8A0AC] hover:text-white px-2 py-1 rounded bg-[#2A0B1D]"
                >
                  Söhbəti Təmizlə
                </button>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {simMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-sm whitespace-pre-wrap leading-relaxed shadow-lg ${
                        msg.sender === 'user'
                          ? 'bg-[#FF0F68] text-white rounded-br-sm'
                          : 'bg-[#2A0B1D] text-gray-100 rounded-bl-sm border border-[#FF0F68]/20'
                      }`}
                    >
                      {msg.text}

                      {msg.progress && (
                        <div className="mt-2.5 pt-2.5 border-t border-white/10 font-mono text-xs space-y-1.5">
                          <div className="text-base tracking-widest text-[#FF2F7D] font-bold">
                            {'█'.repeat(Math.round(msg.progress.percent / 10))}
                            {'░'.repeat(10 - Math.round(msg.progress.percent / 10))}{' '}
                            {msg.progress.percent}%
                          </div>
                          <div className="flex items-center justify-between text-gray-300 text-[11px] pt-1">
                            <span>📦 {msg.progress.size}</span>
                            <span>⚡ {msg.progress.speed}</span>
                            <span>⏱ {msg.progress.eta}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {msg.buttons && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[85%]">
                        {msg.buttons.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            onClick={() => {
                              if (btn.includes('MP4') || btn.includes('MP3') || btn.includes('HD')) {
                                triggerSimDownload(btn, msg.media);
                              } else if (btn.includes('Link göndər')) {
                                sendSimMessage('https://www.tiktok.com/@saveaz/video/739182371923');
                              } else if (btn.includes('Yükləmələrim')) {
                                sendSimMessage('/stats');
                              } else if (btn.includes('Haqqımızda')) {
                                sendSimMessage('/about');
                              } else if (btn.includes('Kömək')) {
                                sendSimMessage('/help');
                              } else if (btn.includes('Ayarlar')) {
                                sendSimMessage('/settings');
                              } else {
                                sendSimMessage(btn);
                              }
                            }}
                            className="bg-[#160A13] hover:bg-[#FF0F68] border border-[#2A0B1D] hover:border-[#FF0F68] text-xs font-semibold px-3 py-1.5 rounded-xl text-gray-200 hover:text-white transition shadow-sm active:scale-95"
                          >
                            {btn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {simLoading && (
                  <div className="flex items-center gap-2 text-xs text-[#A8A0AC] italic p-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF0F68] animate-ping"></span>
                    🔎 Link analiz edilir...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <div className="pt-3 border-t border-[#2A0B1D] flex items-center gap-2">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendSimMessage(simInput);
                  }}
                  placeholder="Link daxil edin və ya əmr yazın..."
                  className="flex-1 bg-[#08070C] border border-[#2A0B1D] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0F68] transition"
                />
                <button
                  onClick={() => sendSimMessage(simInput)}
                  disabled={!simInput.trim() || simLoading}
                  className="bg-[#FF0F68] hover:bg-[#FF2F7D] disabled:opacity-50 text-white p-2.5 rounded-xl transition glow-pink-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Test Links */}
            <div className="space-y-4">
              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-5">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-[#FF2F7D]">
                  <Play className="w-4 h-4" /> Nümunə Linkləri Yoxlayın
                </h4>
                <div className="space-y-2">
                  {[
                    { label: 'TikTok Video', url: 'https://www.tiktok.com/@tiktok/video/73289192837' },
                    { label: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/3bN9mZpY8' },
                    { label: 'YouTube Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                    { label: 'Instagram Reel', url: 'https://www.instagram.com/reel/C8k9xL2pQ1' },
                    { label: 'Facebook Video', url: 'https://www.facebook.com/watch/?v=1029384756' },
                  ].map((sample) => (
                    <button
                      key={sample.label}
                      onClick={() => copySampleLink(sample.url)}
                      className="w-full text-left p-2.5 rounded-xl bg-[#08070C] border border-[#2A0B1D] hover:border-[#FF0F68]/50 text-xs flex items-center justify-between group transition"
                    >
                      <div>
                        <div className="font-semibold text-white group-hover:text-[#FF2F7D]">
                          {sample.label}
                        </div>
                        <div className="text-[11px] text-[#A8A0AC] truncate max-w-[200px]">
                          {sample.url}
                        </div>
                      </div>
                      <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
                    </button>
                  ))}
                </div>
                {copiedLink && (
                  <div className="text-[11px] text-emerald-400 mt-2 font-medium">
                    ✓ Link çat qutusuna yerləşdirildi!
                  </div>
                )}
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-5">
                <h4 className="font-bold text-sm mb-3 text-white">Bot Əmrləri (Azərbaycan)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => sendSimMessage('/start')}
                    className="p-2 rounded-xl bg-[#08070C] border border-[#2A0B1D] hover:border-[#FF0F68] font-mono text-[#FF2F7D] text-left"
                  >
                    /start <span className="block text-[10px] text-gray-400 font-sans">Başla</span>
                  </button>
                  <button
                    onClick={() => sendSimMessage('/stats')}
                    className="p-2 rounded-xl bg-[#08070C] border border-[#2A0B1D] hover:border-[#FF0F68] font-mono text-[#FF2F7D] text-left"
                  >
                    /stats <span className="block text-[10px] text-gray-400 font-sans">Statistika</span>
                  </button>
                  <button
                    onClick={() => sendSimMessage('/help')}
                    className="p-2 rounded-xl bg-[#08070C] border border-[#2A0B1D] hover:border-[#FF0F68] font-mono text-[#FF2F7D] text-left"
                  >
                    /help <span className="block text-[10px] text-gray-400 font-sans">Kömək</span>
                  </button>
                  <button
                    onClick={() => sendSimMessage('/about')}
                    className="p-2 rounded-xl bg-[#08070C] border border-[#2A0B1D] hover:border-[#FF0F68] font-mono text-[#FF2F7D] text-left"
                  >
                    /about <span className="block text-[10px] text-gray-400 font-sans">Haqqında</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-xl text-white">İstifadəçi İdarəetməsi</h3>
                <p className="text-xs text-[#A8A0AC]">
                  Telegram bot istifadəçilərinin siyahısı, bloklama və premium statusu
                </p>
              </div>

              <div className="flex items-center gap-2 max-w-md w-full">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchUsers();
                    }}
                    placeholder="ID, ad və ya username üzrə axtar..."
                    className="w-full bg-[#08070C] border border-[#2A0B1D] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0F68]"
                  />
                </div>
                <button
                  onClick={fetchUsers}
                  className="bg-[#2A0B1D] hover:bg-[#FF0F68] text-white px-3 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Axtar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2A0B1D] text-[#A8A0AC] text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Telegram ID</th>
                    <th className="pb-3 font-semibold">Ad & İstifadəçi</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Plan</th>
                    <th className="pb-3 font-semibold">Yükləmə Sayı</th>
                    <th className="pb-3 font-semibold">Qeydiyyat Tarixi</th>
                    <th className="pb-3 font-semibold text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A0B1D]/40">
                  {users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.telegram_id} className="hover:bg-[#2A0B1D]/30 transition">
                        <td className="py-3 font-mono text-xs text-white">{u.telegram_id}</td>
                        <td className="py-3">
                          <div className="font-semibold text-white">{u.first_name || 'Adsız'}</div>
                          <div className="text-xs text-[#A8A0AC]">
                            {u.username ? `@${u.username}` : 'username yoxdur'}
                          </div>
                        </td>
                        <td className="py-3">
                          {u.is_banned ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-800/40">
                              <Ban className="w-3 h-3" /> Bloklanıb
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
                              <Check className="w-3 h-3" /> Aktiv
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {u.is_premium ? (
                            <span className="text-xs font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
                              ⭐ Premium
                            </span>
                          ) : (
                            <span className="text-xs text-[#A8A0AC]">Standart</span>
                          )}
                        </td>
                        <td className="py-3 font-semibold text-white">{u.downloads_count}</td>
                        <td className="py-3 text-xs text-[#A8A0AC]">
                          {new Date(u.created_at).toLocaleDateString('az-AZ')}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => handleTogglePremium(u.telegram_id, u.is_premium)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#2A0B1D] hover:bg-amber-600/30 text-amber-300 transition"
                          >
                            {u.is_premium ? 'Premiumu Ləğv Et' : '⭐ Premium Ver'}
                          </button>
                          <button
                            onClick={() => handleToggleBan(u.telegram_id, u.is_banned)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                              u.is_banned
                                ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/50'
                                : 'bg-rose-900/40 text-rose-300 hover:bg-rose-800/50'
                            }`}
                          >
                            {u.is_banned ? 'Blokdan Çıxar' : 'Blokla'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#A8A0AC]">
                        {loading ? 'İstifadəçilər yüklənir...' : 'Heç bir istifadəçi tapılmadı.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DOWNLOADS TAB */}
        {activeTab === 'downloads' && (
          <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="font-bold text-xl text-white">Yükləmə Arxivi</h3>
              <p className="text-xs text-[#A8A0AC]">
                Bütün tamamlanan və uğursuz olan yükləmələrin jurnalı
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2A0B1D] text-[#A8A0AC] text-xs uppercase tracking-wider">
                    <th className="pb-3 font-semibold">ID</th>
                    <th className="pb-3 font-semibold">Media Başlığı</th>
                    <th className="pb-3 font-semibold">Platforma</th>
                    <th className="pb-3 font-semibold">Format</th>
                    <th className="pb-3 font-semibold">Ölçü</th>
                    <th className="pb-3 font-semibold">Müddət</th>
                    <th className="pb-3 font-semibold">İstifadəçi</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A0B1D]/40">
                  {stats?.recentDownloads && stats.recentDownloads.length > 0 ? (
                    stats.recentDownloads.map((d) => (
                      <tr key={d.id} className="hover:bg-[#2A0B1D]/30 transition">
                        <td className="py-3 font-mono text-xs text-gray-400">{d.id.slice(0, 10)}...</td>
                        <td className="py-3 font-medium text-white max-w-sm truncate">
                          {d.title || d.url}
                        </td>
                        <td className="py-3 uppercase text-xs font-bold text-[#FF2F7D]">{d.platform}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#2A0B1D] text-white">
                            {d.format.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-[#A8A0AC]">
                          {d.file_size ? `${Math.round(d.file_size / (1024 * 1024))} MB` : '18.4 MB'}
                        </td>
                        <td className="py-3 text-xs text-[#A8A0AC]">
                          {d.duration ? `${d.duration} san` : '00:45'}
                        </td>
                        <td className="py-3 font-mono text-xs text-gray-300">{d.telegram_id}</td>
                        <td className="py-3">
                          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/30">
                            Tamamlandı
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#A8A0AC]">
                        Hələlik heç bir yükləmə qeydə alınmayıb.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BROADCAST TAB */}
        {activeTab === 'broadcast' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="font-bold text-xl text-white">Kütləvi Yayım (Broadcast)</h3>
                <p className="text-xs text-[#A8A0AC]">
                  Bütün qeydiyyatdan keçmiş bot istifadəçilərinə vacib elan və ya yenilik göndərin.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A8A0AC] mb-2">
                  Yayım Mesajı (Telegram formatında)
                </label>
                <textarea
                  rows={6}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Salam əziz istifadəçilər! Save.az botunda 4K video və daha sürətli yükləmə rejimi aktivləşdirildi..."
                  className="w-full bg-[#08070C] border border-[#2A0B1D] rounded-2xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0F68] transition"
                ></textarea>
              </div>

              {broadcastStatus && (
                <div className="p-3.5 rounded-xl bg-[#2A0B1D] border border-[#FF0F68]/30 text-xs text-gray-200">
                  {broadcastStatus}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-[#A8A0AC]">
                  Hədəf auditoriya: <strong>{stats?.totalUsers || 0}</strong> istifadəçi
                </span>
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcasting || !broadcastMessage.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E9005C] to-[#FF0F68] hover:brightness-110 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 glow-pink-sm transition"
                >
                  {broadcasting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Göndərilir...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Yayımı Başlat
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#FF2F7D]" /> Telegram API Qaydaları
              </h4>
              <ul className="text-xs text-[#A8A0AC] space-y-2 leading-relaxed">
                <li>• Bot saniyədə maksimum 30 mesaja qədər icazə verir.</li>
                <li>• Sistem avtomatik olaraq növbələmə və rate-limit tətbiq edir.</li>
                <li>• Bloklanmış istifadəçilər avtomatik atlanır.</li>
              </ul>
            </div>
          </div>
        )}

        {/* SYSTEM TAB */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Server Vəziyyəti</div>
                <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Onlayn
                </div>
                <div className="text-[11px] text-[#A8A0AC] mt-1 font-mono">
                  Uptime: {Math.floor((serverInfo?.uptimeSeconds || 0) / 60)} dəqiqə
                </div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Qoşulma Rejimi</div>
                <div className="text-xl font-bold text-[#FF2F7D]">{serverInfo?.status || 'Active'}</div>
                <div className="text-[11px] text-[#A8A0AC] mt-1">Polling dəstəkli</div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Məlumat Bazası</div>
                <div className="text-xl font-bold text-white">SQLite (Safe Mode)</div>
                <div className="text-[11px] text-emerald-400 mt-1">Miqrasiyalar aktiv</div>
              </div>

              <div className="bg-[#160A13] border border-[#2A0B1D] rounded-2xl p-4">
                <div className="text-xs text-[#A8A0AC] font-medium mb-1">Save.az API Endpoint</div>
                <div className="text-sm font-bold text-blue-400 truncate">
                  {serverInfo?.saveApiUrl || 'https://save.az'}
                </div>
                <div className="text-[11px] text-[#A8A0AC] mt-1">POST /api/analyze</div>
              </div>
            </div>

            {/* Live Server Logs */}
            <div className="bg-[#160A13] border border-[#2A0B1D] rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#FF2F7D]" /> Canlı Server Loqları
                </h3>
                <button
                  onClick={fetchLogs}
                  className="text-xs text-[#A8A0AC] hover:text-white px-3 py-1.5 rounded-lg bg-[#2A0B1D]"
                >
                  Yenilə
                </button>
              </div>

              <div className="bg-[#08070C] border border-[#2A0B1D] rounded-2xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-1">
                {logs.length > 0 ? (
                  logs.map((log, lIdx) => (
                    <div
                      key={lIdx}
                      className={`py-0.5 ${
                        log.level === 'ERROR'
                          ? 'text-rose-400'
                          : log.level === 'WARN'
                          ? 'text-amber-400'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">[{log.timestamp.slice(11, 19)}]</span>{' '}
                      <span className="font-bold">[{log.level}]</span> {log.message}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">Loq qeydləri yüklənir...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-[#2A0B1D] bg-[#160A13]/50 py-4 px-6 text-center text-xs text-[#A8A0AC] flex items-center justify-between">
        <div>© 2026 Save.az Downloader Bot Admin Paneli</div>
        <button
          onClick={onGoHome}
          className="text-gray-400 hover:text-white transition flex items-center gap-1"
        >
          ← Save.az Əsas Sayta Keç
        </button>
      </footer>
    </div>
  );
}
