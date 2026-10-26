import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './src/config/env.js';
import { logger } from './src/utils/logger.js';
import { runMigrations } from './src/database/migrations.js';
import { apiRouter } from './src/api/routes.js';
import { getBot, registerBotCommands } from './src/bot/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Basic Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Run database migrations on startup
  runMigrations();

  // Validate environment
  const { warnings } = validateConfig();
  warnings.forEach(w => logger.warn(w));

  // Mount API & Health routes
  app.use(apiRouter);

  // Initialize Telegram Bot if configured
  const bot = getBot();
  if (bot) {
    await registerBotCommands(bot);

    if (config.BOT_MODE === 'webhook' && config.WEBHOOK_DOMAIN) {
      const webhookUrl = `${config.WEBHOOK_DOMAIN.replace(/\/+$/, '')}${config.WEBHOOK_PATH}`;
      logger.info(`Telegram webhook quraşdırılır: ${webhookUrl}`);
      
      app.use(
        config.WEBHOOK_PATH,
        bot.webhookCallback(config.WEBHOOK_PATH, {
          secretToken: config.WEBHOOK_SECRET,
        })
      );

      bot.telegram.setWebhook(webhookUrl, {
        secret_token: config.WEBHOOK_SECRET,
      }).catch(err => {
        logger.error('Webhook set edilərkən xəta baş verdi', { error: String(err) });
      });
    } else {
      // Long-polling mode
      logger.info('Telegram Bot polling rejimində başladılır...');
      bot.launch().catch(err => {
        logger.error('Telegram bot launch xətası', { error: String(err) });
      });
    }
  }

  // Mount Vite middlewares in development or serve static in production
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.VITE_DEV_SERVER;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logger.info('Vite dev middleware inteqrasiya edildi.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logger.info(`Statik fayllar təqdim edilir: ${distPath}`);
  }

  const server = app.listen(config.PORT, '0.0.0.0', () => {
    logger.info(`🚀 Save.az Server işə düşdü: http://0.0.0.0:${config.PORT} [${config.NODE_ENV}]`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Söndürülmə siqnalı alındı (${signal}). Server təmiz şəkildə bağlanır...`);
    if (bot) {
      try {
        bot.stop(signal);
      } catch {}
    }
    server.close(() => {
      logger.info('HTTP Server bağlandı.');
      process.exit(0);
    });

    // Force close after 10 seconds if graceful close stalls
    setTimeout(() => {
      logger.error('Server məcburi dayandırıldı (timeout).');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.error('Qəfildən tutulmayan istisna (uncaughtException)', { error: String(err), stack: err.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('İdarə olunmayan promise imtinası (unhandledRejection)', { reason: String(reason) });
  });
}

startServer().catch(err => {
  logger.error('Serveri başlatmaq mümkün olmadı', { error: String(err) });
  process.exit(1);
});
