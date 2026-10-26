import { Context } from 'telegraf';
import { upsertUser, getUserStats } from '../../database/db.js';
import { getMainMenuKeyboard, getSettingsKeyboard } from '../keyboards/keyboards.js';
import { logger } from '../../utils/logger.js';

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  upsertUser(telegramId, from.username || null, from.first_name || null);
  logger.info(`[INFO] Telegram user started bot: ${telegramId}`);

  const welcomeText = 
`👋 Salam! Save.az-a xoş gəlmisiniz.

🎬 TikTok, YouTube, Instagram və Facebook videolarını yükləyin.

🔗 Sadəcə video linkini göndərin — qalanını biz edək.`;

  await ctx.reply(welcomeText, getMainMenuKeyboard());
}

export async function handleHelp(ctx: Context) {
  const helpText = 
`❓ Necə istifadə etməli?

1️⃣ TikTok, YouTube, Instagram və ya Facebook linkini kopyalayın.

2️⃣ Linki bu bota göndərin.

3️⃣ Video və ya MP3 formatını seçin.

4️⃣ Faylın hazırlanmasını gözləyin.

5️⃣ Hazır faylı yükləyin.

🔗 Sadəcə linki göndərin.`;

  await ctx.reply(helpText);
}

export async function handleAbout(ctx: Context) {
  const aboutText = 
`ℹ️ Save.az

Save.az sosial media videolarını və musiqilərini rahat şəkildə yadda saxlamaq üçün hazırlanmış platformadır.

Dəstəklənən platformalar:
• TikTok
• YouTube & YouTube Shorts
• Instagram Reels & Post
• Facebook Video & Reels

🚀 Sürətli
🎬 HD / 4K
🎵 MP3
⚡ Sadə istifadə`;

  await ctx.reply(aboutText);
}

export async function handleStats(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const stats = getUserStats(telegramId);

  const statsText = 
`📊 Sizin statistikanız

🎬 Ümumi yükləmə: ${stats.total}
🎵 MP3: ${stats.mp3}
🎥 Video: ${stats.video}

📅 Son istifadə: ${stats.lastActive}`;

  await ctx.reply(statsText);
}

export async function handleSettings(ctx: Context) {
  const settingsText = 
`⚙️ Save.az Bot Ayarları

Buradan dil və standart yükləmə keyfiyyətini idarə edə bilərsiniz.`;

  await ctx.reply(settingsText, getSettingsKeyboard());
}
