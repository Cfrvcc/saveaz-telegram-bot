import { Markup } from 'telegraf';
import { MediaFormatOption } from '../../services/mediaResolver.js';

/**
 * Main menu inline keyboard for /start
 */
export function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔗 Link göndər', 'action_send_link')],
    [Markup.button.callback('📥 Yükləmələrim', 'action_my_downloads')],
    [Markup.button.callback('ℹ️ Haqqımızda', 'action_about')],
    [
      Markup.button.callback('⚙️ Ayarlar', 'action_settings'),
      Markup.button.callback('❓ Kömək', 'action_help'),
    ],
  ]);
}

/**
 * Format selection keyboard for analyzed media
 */
export function getMediaOptionsKeyboard(mediaId: string, formats: MediaFormatOption[]) {
  const buttons = formats.map(fmt => {
    return [
      Markup.button.callback(
        `${fmt.label} (${fmt.approxSizeMb} MB)`,
        `download:${mediaId}:${fmt.format}`
      ),
    ];
  });

  return Markup.inlineKeyboard(buttons);
}

/**
 * YouTube Playlist options keyboard
 */
export function getPlaylistOptionsKeyboard(mediaId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎬 Videolar', `playlist:${mediaId}:video`),
      Markup.button.callback('🎵 MP3', `playlist:${mediaId}:mp3`),
    ],
    [Markup.button.callback('📦 ZIP', `playlist:${mediaId}:zip`)],
  ]);
}

/**
 * Settings inline keyboard
 */
export function getSettingsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🌐 Dil: Azərbaycan 🇦🇿', 'setting_language')],
    [Markup.button.callback('⚡ Standart Keyfiyyət: HD', 'setting_quality')],
    [Markup.button.callback('⬅️ Əsas menyu', 'action_back_main')],
  ]);
}

/**
 * Admin Panel quick actions keyboard
 */
export function getAdminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Ümumi Statistika', 'admin_stats'),
      Markup.button.callback('👥 İstifadəçilər', 'admin_users'),
    ],
    [
      Markup.button.callback('📢 Yayım (Broadcast)', 'admin_broadcast_prompt'),
      Markup.button.callback('🖥 Sistem Statusu', 'admin_status'),
    ],
  ]);
}
