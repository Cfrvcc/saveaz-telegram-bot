import { Telegraf, Context } from 'telegraf';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { extractUrlFromText, validateMediaUrl } from '../utils/urlValidator.js';
import { formatBytes, formatDuration } from '../utils/formatters.js';
import {
  handleStart,
  handleHelp,
  handleAbout,
  handleStats,
  handleSettings,
} from './commands/userCommands.js';
import {
  handleAdmin,
  handleAdminStats,
  handleAdminUsers,
  handleAdminUser,
  handleAdminBan,
  handleAdminStatus,
  isAdmin,
} from './commands/adminCommands.js';
import {
  getMainMenuKeyboard,
  getMediaOptionsKeyboard,
  getPlaylistOptionsKeyboard,
} from './keyboards/keyboards.js';
import { saveAzApiClient } from '../services/saveAzApiClient.js';
import { startDownloadJob, buildProgressText } from '../services/downloader.js';
import {
  upsertUser,
  getUser,
  checkRateLimit,
  getAllUsers,
} from '../database/db.js';
import { answerUserQuestion } from '../services/geminiService.js';

let botInstance: Telegraf | null = null;
const cachedMediaMetadata = new Map<string, any>();

export function getBot(): Telegraf | null {
  if (botInstance) return botInstance;
  if (!config.TELEGRAM_BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN təyin edilməyib. Telegram botu deaktivdir, lakin veb panel və simulyator aktivdir.');
    return null;
  }

  try {
    botInstance = new Telegraf(config.TELEGRAM_BOT_TOKEN);
    setupBotHandlers(botInstance);
    return botInstance;
  } catch (err) {
    logger.error('Telegram bot inisializasiya xətası', { error: String(err) });
    return null;
  }
}

function setupBotHandlers(bot: Telegraf) {
  // Global error handler
  bot.catch((err, ctx) => {
    logger.error('Telegraf xətası', { error: String(err), updateType: ctx.updateType });
  });

  // User Commands
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command('about', handleAbout);
  bot.command('stats', handleStats);
  bot.command('settings', handleSettings);

  // Admin Commands
  bot.command('admin', handleAdmin);
  bot.command('stat', handleAdminStats);
  bot.command('users', handleAdminUsers);
  bot.command('status', handleAdminStatus);

  bot.command('ban', async (ctx) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(/\s+/);
    await handleAdminBan(ctx, parts[1], true);
  });

  bot.command('unban', async (ctx) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(/\s+/);
    await handleAdminBan(ctx, parts[1], false);
  });

  bot.command('user', async (ctx) => {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.split(/\s+/);
    await handleAdminUser(ctx, parts[1]);
  });

  bot.command('broadcast', async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) return;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const messageToSend = text.replace(/^\/broadcast\s*/, '').trim();

    if (!messageToSend) {
      await ctx.reply('İstifadə qaydası: /broadcast <mesaj mətni>');
      return;
    }

    const { users } = getAllUsers(1, 1000);
    await ctx.reply(`📢 Yayım başladıldı... Cəmi: ${users.length} istifadəçi.`);

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.telegram_id, messageToSend);
        sent++;
        // Respect Telegram API rate limits (approx 30 msgs per second)
        await new Promise((r) => setTimeout(r, 60));
      } catch {
        failed++;
      }
    }

    await ctx.reply(`✅ Yayım tamamlandı!\nUğurlu: ${sent}\nUğursuz: ${failed}`);
  });

  // Inline Button Actions
  bot.action('action_send_link', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('🔗 Zəhmət olmasa TikTok, YouTube, Instagram və ya Facebook video linkini göndərin.');
  });

  bot.action('action_my_downloads', async (ctx) => {
    await ctx.answerCbQuery();
    await handleStats(ctx);
  });

  bot.action('action_about', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAbout(ctx);
  });

  bot.action('action_help', async (ctx) => {
    await ctx.answerCbQuery();
    await handleHelp(ctx);
  });

  bot.action('action_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await handleSettings(ctx);
  });

  bot.action('action_back_main', async (ctx) => {
    await ctx.answerCbQuery();
    await handleStart(ctx);
  });

  bot.action('admin_stats', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAdminStats(ctx);
  });

  bot.action('admin_users', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAdminUsers(ctx);
  });

  bot.action('admin_status', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAdminStatus(ctx);
  });

  // Download Trigger Handler
  bot.action(/^download:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const mediaId = ctx.match[1];
    const format = ctx.match[2] as 'mp4' | 'mp3' | 'hd' | '4k';

    const media = cachedMediaMetadata.get(mediaId);
    const from = ctx.from;
    if (!from) return;

    const telegramId = String(from.id);
    const user = getUser(telegramId);
    if (user?.is_banned) {
      await ctx.reply('🚫 Hesabınız bloklanmışdır.');
      return;
    }

    const initialMsg = await ctx.reply(
      `⬇️ Yüklənir...\n\n░░░░░░░░░░ 0%\n\n📦 Hazırlanır...\n⚡ Hesablanır...\n⏱ Gözləyin...`
    );

    try {
      // 1. Send download request to Save.az: POST /api/download
      const downloadResponse = await saveAzApiClient.download({
        telegramId,
        url: media?.url || 'https://save.az',
        platform: media?.platform || 'media',
        format,
        title: media?.title,
        duration: media?.durationSeconds,
        approxSizeMb: media?.approxSizeMb,
      });

      if (!downloadResponse.success || !downloadResponse.jobId) {
        await ctx.telegram.editMessageText(
          ctx.chat?.id || from.id,
          initialMsg.message_id,
          undefined,
          downloadResponse.error || '⚠️ Video hazırda yüklənə bilmədi. Bir az sonra yenidən cəhd edin.'
        );
        return;
      }

      const jobId = downloadResponse.jobId;
      logger.info(`Save.az download işi qəbul edildi: jobId=${jobId}`);

      // 2. Poll progress via Save.az: GET /api/download/:jobId/progress
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 100; // max ~2 minutes
      let lastRenderedPercent = -1;

      while (!isDone && attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1200));

        const progress = await saveAzApiClient.getProgress(jobId);

        if (!progress) {
          continue;
        }

        // Only update Telegram message if progress percent changed or status completed
        if (progress.percentage !== lastRenderedPercent || progress.status === 'completed') {
          lastRenderedPercent = progress.percentage;
          const progressText = buildProgressText(progress);

          try {
            await ctx.telegram.editMessageText(
              ctx.chat?.id || from.id,
              initialMsg.message_id,
              undefined,
              progressText
            );
          } catch {
            // Ignore rapid editing rate-limit from Telegram API
          }
        }

        if (progress.status === 'completed' || progress.percentage >= 100) {
          isDone = true;

          // Final delivery message
          if (format === 'mp3') {
            let audioMsg = `🎵 Save.az\n\nMusiqi uğurla hazırlandı.\n\n🎬 ${media?.title || 'Audio Trek'}\n⏱ ${formatDuration(media?.durationSeconds || 180)}`;
            if (progress.fileUrl) {
              audioMsg += `\n\n📥 Birbaşa yüklə: ${progress.fileUrl}`;
            }
            await ctx.reply(audioMsg);
          } else {
            let videoMsg = `🎬 Save.az\n\nVideo uğurla hazırlandı (${format.toUpperCase()}).\n\n📌 ${media?.title || 'Video'}\n👤 ${media?.author || '@creator'}`;
            if (progress.fileUrl) {
              videoMsg += `\n\n📥 Birbaşa yüklə: ${progress.fileUrl}`;
            }
            await ctx.reply(videoMsg);
          }
          break;
        }

        if (progress.status === 'failed') {
          isDone = true;
          await ctx.reply(
            '⚠️ Video hazırda yüklənə bilmədi.\n\nSəbəb: platformanın müvəqqəti məhdudiyyəti.\n\nBir az sonra yenidən cəhd edin.'
          );
          break;
        }
      }

      if (!isDone) {
        await ctx.reply('⚠️ Yükləmə vaxt aşımına uğradı. Bir az sonra yenidən cəhd edin.');
      }
    } catch (err) {
      logger.error('Download prosesində xəta', { error: String(err) });
      await ctx.reply(
        '⚠️ Video hazırda yüklənə bilmədi.\n\nSəbəb: platformanın müvəqqəti məhdudiyyəti.\n\nBir az sonra yenidən cəhd edin.'
      );
    }
  });

  // Playlist Handler
  bot.action(/^playlist:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const mediaId = ctx.match[1];
    const action = ctx.match[2];
    const media = cachedMediaMetadata.get(mediaId);

    await ctx.reply(
      `📋 Playlist emal edilir (${action.toUpperCase()})...\n\n` +
      `📦 Cəmi: ${media?.playlistCount || 10} fayl.\n` +
      `Zəhmət olmasa gözləyin, fayllar ardıcıl olaraq göndəriləcək.`
    );
  });

  // Universal Message / URL Listener
  bot.on('text', async (ctx) => {
    const from = ctx.from;
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) {
      // Unrecognized commands
      return;
    }

    const telegramId = String(from.id);
    const user = upsertUser(telegramId, from.username || null, from.first_name || null);

    // Ban check
    if (user.is_banned) {
      await ctx.reply('🚫 Hesabınız inzibatçı tərəfindən bloklanmışdır.');
      return;
    }

    // Rate limit check
    const rate = checkRateLimit(`user:${telegramId}`, config.RATE_LIMIT_PER_MINUTE, 60);
    if (!rate.allowed) {
      await ctx.reply('⚠️ Çox tez-tez sorğu göndərirsiniz. Bir az sonra yenidən cəhd edin.');
      return;
    }

    // Extract URL
    const detectedUrl = extractUrlFromText(text);

    if (!detectedUrl) {
      // Natural language message: Provide helpful AI or standard Azerbaijani response
      const answer = await answerUserQuestion(text, from.first_name);
      await ctx.reply(answer);
      return;
    }

    logger.info(`[INFO] URL received from ${telegramId}: ${detectedUrl}`);
    const statusMsg = await ctx.reply('🔎 Link analiz edilir...');

    const analysis = await saveAzApiClient.analyze(detectedUrl);

    if (!analysis.success || !analysis.data) {
      const errorMsg = analysis.error || '❌ Bu linki hazırda dəstəkləyə bilmirik.';
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        errorMsg
      );
      return;
    }

    const data = analysis.data;
    cachedMediaMetadata.set(data.id, data);

    if (data.isPlaylist) {
      const playlistMsg = 
`📋 Playlist aşkarlandı.

🎬 Başlıq: ${data.title}
Neçə video var: ${data.playlistCount || 10}

Seçim edin:`;
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        playlistMsg,
        getPlaylistOptionsKeyboard(data.id)
      );
      return;
    }

    const infoText = 
`🎬 Video adı: ${data.title}
👤 Müəllif: ${data.author}
⏱ Müddət: ${formatDuration(data.durationSeconds)}
📦 Təxmini ölçü: ${data.approxSizeMb} MB

Yükləmək istədiyiniz formatı seçin:`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      infoText,
      getMediaOptionsKeyboard(data.id, data.availableFormats)
    );
  });
}

/**
 * Configure Telegram Bot Commands Menu
 */
export async function registerBotCommands(bot: Telegraf) {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Botu başlat və əsas menyu' },
      { command: 'help', description: 'Necə istifadə etməli' },
      { command: 'about', description: 'Save.az haqqında məlumat' },
      { command: 'stats', description: 'Şəxsi yükləmə statistikası' },
      { command: 'settings', description: 'Bot parametrləri' },
    ]);
    logger.info('Telegram Bot menyu əmrləri qeydiyyatdan keçdi.');
  } catch (err) {
    logger.warn('Menyu əmrləri qeydiyyatdan keçirilə bilmədi', { error: String(err) });
  }
}
