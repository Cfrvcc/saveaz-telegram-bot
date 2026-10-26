import express, { Request, Response } from 'express';
import { validateMediaUrl, extractUrlFromText } from '../utils/urlValidator.js';
import { resolveMediaMetadata } from '../services/mediaResolver.js';
import { startDownloadJob, getJobProgress, getAllActiveJobs } from '../services/downloader.js';
import {
  getGlobalStats,
  getAllUsers,
  setUserBanStatus,
  setUserPremiumStatus,
  getUser,
  getUserDownloads,
  upsertUser,
} from '../database/db.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { getBot } from '../bot/bot.js';
import { answerUserQuestion, generateAdminSummary } from '../services/geminiService.js';

export const apiRouter = express.Router();

/**
 * Health check endpoint
 * Section 27
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'save.az-telegram-bot',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Backend status endpoint
 */
apiRouter.get('/api/status', (_req: Request, res: Response) => {
  const uptime = process.uptime();
  res.json({
    status: 'online',
    version: '1.0.0',
    mode: config.BOT_MODE,
    saveApiUrl: config.SAVE_API_URL,
    uptimeSeconds: Math.floor(uptime),
    database: 'sqlite-ready',
    activeJobsCount: getAllActiveJobs().length,
    telegramConfigured: Boolean(config.TELEGRAM_BOT_TOKEN),
  });
});

/**
 * Save.az Analyze Endpoint
 * POST /api/analyze (and alias POST /api/bot/analyze)
 */
const handleAnalyze = async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ success: false, error: 'URL tələb olunur.' });
    return;
  }

  const validated = validateMediaUrl(url);
  if (!validated.isValid) {
    res.status(400).json({
      success: false,
      error: validated.error || '❌ Bu linki hazırda dəstəkləyə bilmirik.',
      errorCode: 'INVALID_URL',
    });
    return;
  }

  try {
    const metadata = await resolveMediaMetadata(validated);
    res.json({
      success: true,
      data: metadata,
      ...metadata,
    });
  } catch (err: unknown) {
    logger.error('API /api/analyze xətası', { error: String(err) });
    res.status(500).json({
      success: false,
      error: '⚠️ Server daxili xəta baş verdi.',
      errorCode: 'SERVER_ERROR',
    });
  }
};

apiRouter.post('/api/analyze', handleAnalyze);
apiRouter.post('/api/bot/analyze', handleAnalyze);

/**
 * Save.az Download Endpoint
 * POST /api/download (and alias POST /api/bot/download)
 */
const handleDownload = async (req: Request, res: Response): Promise<void> => {
  const { telegramId, url, platform, format, title, duration, approxSizeMb } = req.body;

  if (!url) {
    res.status(400).json({ success: false, error: 'URL tələb olunur.' });
    return;
  }

  const validated = validateMediaUrl(url);

  try {
    const job = await startDownloadJob({
      telegramId: telegramId ? String(telegramId) : 'guest_web',
      url,
      platform: platform || validated.platform || 'media',
      format: format || 'mp4',
      title,
      duration,
      approxSizeMb,
    });

    res.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
    });
  } catch (err: unknown) {
    logger.error('API /api/download xətası', { error: String(err) });
    res.status(500).json({
      success: false,
      jobId: '',
      status: 'failed',
      error: 'Yükləmə başlatmaq mümkün olmadı.',
    });
  }
};

apiRouter.post('/api/download', handleDownload);
apiRouter.post('/api/bot/download', handleDownload);

/**
 * Save.az Download Progress Endpoint
 * GET /api/download/:jobId/progress (and alias GET /api/bot/download/:jobId/progress)
 */
const handleProgress = (req: Request, res: Response): void => {
  const { jobId } = req.params;
  const progress = getJobProgress(jobId);

  if (!progress) {
    res.status(404).json({ error: 'İş tapılmadı' });
    return;
  }

  res.json(progress);
};

apiRouter.get('/api/download/:jobId/progress', handleProgress);
apiRouter.get('/api/bot/download/:jobId/progress', handleProgress);

import {
  verifyAdminCredentials,
  createAdminSession,
  validateAdminSession,
  destroyAdminSession,
  requireAdminAuth,
} from '../middleware/adminAuth.js';

// ----------------- ADMIN AUTHENTICATION ROUTES ----------------- //

/**
 * Admin Login Endpoint
 * POST /api/admin/login
 */
apiRouter.post('/api/admin/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      success: false,
      error: 'İstifadəçi adı və şifrə tələb olunur.',
    });
    return;
  }

  const isValid = verifyAdminCredentials(String(username).trim(), String(password));

  if (!isValid) {
    logger.warn(`Uğursuz admin giriş cəhdi: ${username}`);
    res.status(401).json({
      success: false,
      error: 'İstifadəçi adı və ya şifrə yanlışdır.',
    });
    return;
  }

  const token = createAdminSession(username);
  res.json({
    success: true,
    token,
    username,
    message: 'Uğurla daxil oldunuz.',
  });
});

/**
 * Check Admin Session Status
 * GET /api/admin/me
 */
apiRouter.get('/api/admin/me', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-admin-token'] as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = customHeader.trim();
  }

  if (!token || !validateAdminSession(token)) {
    res.status(401).json({
      success: false,
      authenticated: false,
      error: 'Sessiya etibarsızdır və ya vaxtı bitib.',
    });
    return;
  }

  res.json({
    success: true,
    authenticated: true,
    username: config.ADMIN_USERNAME,
  });
});

/**
 * Admin Logout Endpoint
 * POST /api/admin/logout
 */
apiRouter.post('/api/admin/logout', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-admin-token'] as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (customHeader) {
    token = customHeader.trim();
  }

  if (token) {
    destroyAdminSession(token);
  }

  res.json({ success: true, message: 'Çıxış edildi.' });
});

// ----------------- PROTECTED ADMIN DATA ROUTES ----------------- //

apiRouter.get('/api/admin/overview', requireAdminAuth, async (_req: Request, res: Response) => {
  const stats = getGlobalStats();
  const summaryPromise = generateAdminSummary(stats);
  const timeoutPromise = new Promise<string>((resolve) =>
    setTimeout(() => resolve('Sistem stabil işləyir. Yükləmələr və istifadəçi aktivliyi normal səviyyədədir.'), 1200)
  );
  const summary = await Promise.race([summaryPromise, timeoutPromise]);

  res.json({
    success: true,
    stats,
    aiSummary: summary,
    activeJobs: getAllActiveJobs(),
    serverInfo: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      environment: config.NODE_ENV,
      botMode: config.BOT_MODE,
      adminIds: config.ADMIN_TELEGRAM_IDS,
    },
  });
});

apiRouter.get('/api/admin/users', requireAdminAuth, (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'), 10);
  const search = String(req.query.search || '');
  const limit = parseInt(String(req.query.limit || '50'), 10);

  const result = getAllUsers(page, limit, search);
  res.json({ success: true, ...result });
});

apiRouter.post('/api/admin/users/:telegramId/ban', requireAdminAuth, (req: Request, res: Response): void => {
  const { telegramId } = req.params;
  const { isBanned } = req.body;

  const success = setUserBanStatus(telegramId, Boolean(isBanned));
  res.json({ success });
});

apiRouter.post('/api/admin/users/:telegramId/premium', requireAdminAuth, (req: Request, res: Response): void => {
  const { telegramId } = req.params;
  const { isPremium } = req.body;

  const success = setUserPremiumStatus(telegramId, Boolean(isPremium));
  res.json({ success });
});

apiRouter.get('/api/admin/users/:telegramId', requireAdminAuth, (req: Request, res: Response): void => {
  const { telegramId } = req.params;
  const user = getUser(telegramId);
  if (!user) {
    res.status(404).json({ success: false, error: 'İstifadəçi tapılmadı' });
    return;
  }
  const downloads = getUserDownloads(telegramId, 20);
  res.json({ success: true, user, downloads });
});

apiRouter.post('/api/admin/broadcast', requireAdminAuth, async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    res.status(400).json({ success: false, error: 'Mesaj daxil edilməyib.' });
    return;
  }

  const bot = getBot();
  const { users } = getAllUsers(1, 1000);
  let sent = 0;
  let failed = 0;

  if (bot) {
    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.telegram_id, message);
        sent++;
        await new Promise((r) => setTimeout(r, 60));
      } catch {
        failed++;
      }
    }
  } else {
    // Simulated broadcast when telegram bot token is running in local test mode
    sent = users.length;
  }

  logger.info(`[ADMIN] Broadcast sent to ${sent} users (${failed} failed)`);
  res.json({ success: true, sent, failed, total: users.length });
});

apiRouter.get('/api/admin/logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    logs: logger.getRecentLogs(),
  });
});

/**
 * Web Bot Interactive Simulator API
 * Allows developers and admins to simulate the exact Telegram interaction
 * right inside the browser preview.
 */
apiRouter.post('/api/test/simulate-message', async (req: Request, res: Response): Promise<void> => {
  const { text, telegramId = '999888777', username = 'saveaz_tester', firstName = 'Sınaq İstifadəçisi' } = req.body;

  if (!text) {
    res.status(400).json({ error: 'Mətn daxil edilməyib' });
    return;
  }

  const user = upsertUser(telegramId, username, firstName);

  if (user.is_banned) {
    res.json({
      type: 'text',
      message: '🚫 Hesabınız inzibatçı tərəfindən bloklanmışdır.',
    });
    return;
  }

  // Handle bot commands in simulation
  if (text === '/start') {
    res.json({
      type: 'start',
      message: '👋 Salam! Save.az-a xoş gəlmisiniz.\n\n🎬 TikTok, YouTube, Instagram və Facebook videolarını yükləyin.\n\n🔗 Sadəcə video linkini göndərin — qalanını biz edək.',
      buttons: ['🔗 Link göndər', '📥 Yükləmələrim', 'ℹ️ Haqqımızda', '⚙️ Ayarlar', '❓ Kömək'],
    });
    return;
  }

  if (text === '/help') {
    res.json({
      type: 'text',
      message: '❓ Necə istifadə etməli?\n\n1️⃣ TikTok, YouTube, Instagram və ya Facebook linkini kopyalayın.\n2️⃣ Linki bu bota göndərin.\n3️⃣ Video və ya MP3 formatını seçin.\n4️⃣ Faylın hazırlanmasını gözləyin.\n5️⃣ Hazır faylı yükləyin.\n\n🔗 Sadəcə linki göndərin.',
    });
    return;
  }

  if (text === '/about') {
    res.json({
      type: 'text',
      message: 'ℹ️ Save.az\n\nSave.az sosial media videolarını və musiqilərini rahat şəkildə yadda saxlamaq üçün hazırlanmış platformadır.\n\nDəstəklənən platformalar:\nTikTok\nYouTube\nInstagram\nFacebook\n\n🚀 Sürətli\n🎬 HD / 4K\n🎵 MP3\n⚡ Sadə istifadə',
    });
    return;
  }

  const detectedUrl = extractUrlFromText(text);
  if (!detectedUrl) {
    const answer = await answerUserQuestion(text, firstName);
    res.json({
      type: 'text',
      message: answer,
    });
    return;
  }

  const validated = validateMediaUrl(detectedUrl);
  if (!validated.isValid) {
    res.json({
      type: 'error',
      message: validated.error || '❌ Bu linki hazırda dəstəkləyə bilmirik.',
    });
    return;
  }

  try {
    const media = await resolveMediaMetadata(validated);
    res.json({
      type: 'media_found',
      data: media,
      message: `🎬 Video adı: ${media.title}\n👤 Müəllif: ${media.author}\n⏱ Müddət: ${media.durationSeconds} saniyə\n📦 Təxmini ölçü: ${media.approxSizeMb} MB`,
    });
  } catch {
    res.json({
      type: 'error',
      message: '⚠️ Video hazırda analiz edilə bilmədi. Bir az sonra yenidən cəhd edin.',
    });
  }
});
