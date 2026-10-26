import { Context } from 'telegraf';
import { config } from '../../config/env.js';
import {
  getGlobalStats,
  getAllUsers,
  getUser,
  setUserBanStatus,
  getUserDownloads,
} from '../../database/db.js';
import { getAdminMenuKeyboard } from '../keyboards/keyboards.js';
import { logger } from '../../utils/logger.js';
import { formatBytes } from '../../utils/formatters.js';

export function isAdmin(telegramId: string | number | undefined): boolean {
  if (!telegramId) return false;
  return config.ADMIN_TELEGRAM_IDS.includes(String(telegramId));
}

export async function handleAdmin(ctx: Context) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) {
    await ctx.reply('⛔ Bu əmr yalnız Save.az inzibatçıları üçün nəzərdə tutulub.');
    return;
  }

  const adminText = 
`🛡 Save.az İdarəetmə Paneli (Admin)

Xoş gəldiniz, ${from.first_name}!
Aşağıdakı düymələrlə və ya əmrlərlə sistemi idarə edə bilərsiniz:

Əmrlər:
/stat — Sistem statistikası
/users — Son istifadəçilər
/user <ID> — İstifadəçi məlumatı
/ban <ID> — İstifadəçini blokla
/unban <ID> — Blokdan çıxar
/broadcast <mesaj> — Bütün istifadəçilərə elan
/status — Server və API vəziyyəti`;

  await ctx.reply(adminText, getAdminMenuKeyboard());
}

export async function handleAdminStats(ctx: Context) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) return;

  const stats = getGlobalStats();

  const msg = 
`📊 Save.az Bot Qlobal Statistikası:

👥 Ümumi istifadəçilər: ${stats.totalUsers}
🟢 Aktiv istifadəçilər (24s): ${stats.activeUsers}
📥 Ümumi yükləmələr: ${stats.totalDownloads}
🎬 Video yükləmələri: ${stats.videoDownloads}
🎵 MP3 yükləmələri: ${stats.mp3Downloads}
❌ Uğursuz yükləmələr: ${stats.failedCount}

Platformalar:
• TikTok: ${stats.platformStats.tiktok || 0}
• YouTube: ${stats.platformStats.youtube || 0}
• Instagram: ${stats.platformStats.instagram || 0}
• Facebook: ${stats.platformStats.facebook || 0}`;

  await ctx.reply(msg);
}

export async function handleAdminUsers(ctx: Context) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) return;

  const { users, total } = getAllUsers(1, 10);

  let msg = `👥 Son Qeydiyyatdan Keçən İstifadəçilər (Cəmi: ${total}):\n\n`;

  users.forEach((u, i) => {
    const status = u.is_banned ? '🚫 Bloklu' : u.is_premium ? '⭐ Premium' : '✅ Aktiv';
    msg += `${i + 1}. ${u.first_name || 'Adsız'} (@${u.username || 'yoxdur'}) - ID: \`${u.telegram_id}\` [${status}] (${u.downloads_count} yükləmə)\n`;
  });

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

export async function handleAdminUser(ctx: Context, targetId: string) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) return;

  if (!targetId) {
    await ctx.reply('İstifadəçi ID-sini qeyd edin. Məsələn: /user 123456789');
    return;
  }

  const user = getUser(targetId);
  if (!user) {
    await ctx.reply(`❌ ${targetId} ID-li istifadəçi tapılmadı.`);
    return;
  }

  const downloads = getUserDownloads(targetId, 5);

  let msg = 
`👤 İstifadəçi Haqqında Məlumat:

ID: \`${user.telegram_id}\`
Ad: ${user.first_name || '-'}
Username: @${user.username || '-'}
Dil: ${user.language}
Status: ${user.is_banned ? '🚫 Bloklanıb' : '🟢 Aktiv'}
Premium: ${user.is_premium ? 'Bəli' : 'Xeyr'}
Cəmi Yükləmələr: ${user.downloads_count}
Qeydiyyat: ${new Date(user.created_at).toLocaleString('az-AZ')}
Son fəaliyyət: ${new Date(user.last_activity).toLocaleString('az-AZ')}

Son 5 yükləmə:
`;

  if (downloads.length === 0) {
    msg += 'Hələ yükləmə etməyib.';
  } else {
    downloads.forEach((d, i) => {
      msg += `${i + 1}. [${d.platform.toUpperCase()}] ${d.title?.slice(0, 25)}... (${formatBytes(d.file_size)})\n`;
    });
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

export async function handleAdminBan(ctx: Context, targetId: string, ban = true) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) return;

  if (!targetId) {
    await ctx.reply(`İstifadəçi ID-sini daxil edin. Məsələn: /${ban ? 'ban' : 'unban'} 123456789`);
    return;
  }

  const success = setUserBanStatus(targetId, ban);
  if (success) {
    await ctx.reply(`✅ İstifadəçi (\`${targetId}\`) ${ban ? 'bloklandı 🚫' : 'blokdan çıxarıldı 🟢'}.`, { parse_mode: 'Markdown' });
    logger.info(`[ADMIN] User ${targetId} was ${ban ? 'banned' : 'unbanned'} by ${from.id}`);
  } else {
    await ctx.reply(`❌ İstifadəçi tapılmadı.`);
  }
}

export async function handleAdminStatus(ctx: Context) {
  const from = ctx.from;
  if (!from || !isAdmin(from.id)) return;

  const uptime = process.uptime();
  const uptimeMins = Math.floor(uptime / 60);
  const memory = process.memoryUsage();

  const msg = 
`🖥 Server və Sistem Statusu:

🟢 Bot vəziyyəti: Aktiv
⏱ Uptime: ${uptimeMins} dəqiqə
💾 Yaddaş: ${Math.round(memory.rss / (1024 * 1024))} MB
⚙️ Rejim: ${config.BOT_MODE}
🌐 Save.az API: ${config.SAVE_API_URL}
🗄 Database: SQLite / WAL hazır`;

  await ctx.reply(msg);
}
