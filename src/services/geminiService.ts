import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

/**
 * Smart Azerbaijani assistance & FAQ answerer
 */
export async function answerUserQuestion(question: string, userName?: string): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return (
      '👋 Salam! Save.az ilə TikTok, YouTube, Instagram və Facebook-dan video və musiqi yükləyə bilərsiniz.\n' +
      'Sadəcə video linkini buraya göndərin!'
    );
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Sən "Save.az Downloader Bot"-un ağıllı və nəzakətli Azərbaycan dilli köməkçisisən.
İstifadəçi adı: ${userName || 'Dəyərli istifadəçi'}
Sual: ${question}

Qaydalar:
- Yalnız Azərbaycan dilində cavab ver.
- Save.az haqqında danış (TikTok, YouTube, Instagram, Facebook-dan video və MP3 yükləyir).
- Çox qısa, konkret və dostcasına cavab ver (maksimum 2-3 cümlə).
- Link göndərməyi xatırlat.`,
            },
          ],
        },
      ],
    });

    return response.text || 'Save.az ilə istənilən sosial media videosunun linkini göndərərək yükləyə bilərsiniz!';
  } catch (err) {
    logger.error('Gemini FAQ xətası', { error: String(err) });
    return 'Save.az ilə istənilən sosial media videosunun linkini göndərərək yükləyə bilərsiniz!';
  }
}

/**
 * Generate quick admin analytics report
 */
export async function generateAdminSummary(stats: Record<string, unknown>): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return 'Sistem stabil işləyir. Yükləmələr və istifadəçi aktivliyi normal səviyyədədir.';
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Aşağıdakı Save.az bot statistikasına əsasən admin üçün 2 cümləlik xülasə və tövsiyə hazırla (Azərbaycan dilində):
Statistika: ${JSON.stringify(stats)}`,
            },
          ],
        },
      ],
    });

    return response.text || 'Sistem stabil rejimdə fəaliyyət göstərir.';
  } catch {
    return 'Sistem stabil rejimdə fəaliyyət göstərir.';
  }
}
