# Save.az Downloader Bot — Production Setup & Architecture

Azərbaycan dilində TikTok, YouTube, Instagram və Facebook video və audio (MP3) yükləyici Telegram botu və Web İdarəetmə Paneli.

---

## 1. Layihə Strukturu

```
saveaz-telegram-bot/
├── .env.example              # Nümunə konfiqurasiya
├── Dockerfile                # Node 22 + FFmpeg + yt-dlp container
├── docker-compose.yml        # Persistent SQLite volume və production deploy
├── migrations/
│   └── 001_init.sql          # İlkin verilənlər bazası sxemi
├── src/
│   ├── api/
│   │   └── routes.ts         # /health, /api/status, /api/bot/*, /api/admin/*
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── userCommands.ts   # /start, /help, /about, /stats, /settings
│   │   │   └── adminCommands.ts  # /admin, /stat, /users, /ban, /unban, /broadcast
│   │   ├── keyboards/
│   │   │   └── keyboards.ts      # Inline & reply düymələri
│   │   └── bot.ts                # Telegraf axını, URL qəbulu, mesaj edit ilə progress
│   ├── config/
│   │   └── env.ts            # Mühit dəyişənləri və validasiya
│   ├── database/
│   │   ├── db.ts             # SQLite (better-sqlite3) bağlantısı və sorğular
│   │   ├── schema.ts         # Model interfeysləri
│   │   └── migrations.ts     # Avtomatik miqrasiya işlədicisi
│   ├── services/
│   │   ├── downloader.ts     # Yükləmə növbəsi və canlı progress
│   │   ├── mediaResolver.ts  # Sosial media linklərinin analizi və formatlar
│   │   ├── saveAzApiClient.ts# Save.az backend API inteqrasiya layı
│   │   └── geminiService.ts  # Ağıllı FAQ və admin analitika xülasəsi
│   ├── utils/
│   │   ├── formatters.ts     # Progress bar (████████░░), ölçü, sürət, fayl adı
│   │   ├── logger.ts         # Maskalanmış strukturlaşdırılmış loqlar
│   │   └── urlValidator.ts   # SSRF qorunması, private IP bloklama, platform filtri
│   ├── App.tsx               # Save.az neon-magenta dizaynlı Web İdarəetmə Paneli & Bot Simulyatoru
│   ├── index.css             # Tailwind və Save.az rəng palitrası
│   └── main.tsx              # React mount
├── server.ts                 # Express server + Vite middlewares + Graceful shutdown
├── package.json
└── tsconfig.json
```

---

## 2. Mühit Dəyişənləri (Environment Variables)

`.env.example` faylını `.env` olaraq kopyalayın:

```bash
cp .env.example .env
```

| Dəyişən | Təsvir | Nümunə |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather-dən alınan Telegram bot tokeni | `7123456789:ABCdef...` |
| `SAVE_API_URL` | Save.az əsas video emalı backend API ünvanı | `https://api.save.az` |
| `ADMIN_TELEGRAM_IDS` | Vergüllə ayrılmış admin Telegram ID-ləri | `123456789,987654321` |
| `DATABASE_URL` | SQLite fayl yolu və ya PostgreSQL bağlantısı | `./data/saveaz.db` |
| `BOT_MODE` | Bot iş rejimi (`polling` və ya `webhook`) | `webhook` |
| `WEBHOOK_DOMAIN` | Webhook üçün ictimai HTTPS domen | `https://bot.save.az` |
| `WEBHOOK_SECRET` | Telegram webhook gizli açarı | `my-secure-token` |
| `GEMINI_API_KEY` | (Opsional) Smart FAQ və AI analitika üçün | `AIzaSy...` |
| `PORT` | HTTP server portu | `3000` |

---

## 3. Telegram Botunun Yaradılması

1. Telegram-da **@BotFather** botunu açın.
2. `/newbot` əmrini göndərin.
3. Bot üçün ad təyin edin: `Save.az Downloader Bot`
4. İstifadəçi adı (username) seçin: məs. `SaveAzDownloaderBot`
5. Aldığınız `API Token`-i kopyalayıb `.env` faylında `TELEGRAM_BOT_TOKEN` dəyişəninə yazın.
6. Öz Telegram ID-nizi öyrənmək üçün Telegram-da **@userinfobot** və ya **@raw_data_bot** istifadə edin və onu `ADMIN_TELEGRAM_IDS` sahəsinə əlavə edin.

---

## 4. Google AI Studio-da İnkişaf və Test

Bu layihə Google AI Studio mühitində birbaşa tam funksional işləyir:
- Web Admin Paneldə yerləşən **"Bot Sınaq & Simulyator"** tabı vasitəsilə Telegram tokeni olmadan belə TikTok, YouTube, Instagram və Facebook linklərini, format seçimini və canlı progress bar animasiyasını test edə bilərsiniz.
- Express serveri dev rejimində həm API sorğularını, həm də Vite client-i emal edir.

---

## 5. Lokal İşə Salma (Local Development)

```bash
# Asılılıqları quraşdırın
npm install

# Serveri və client-i inkişaf rejimində başladın
npm run dev
```

Brauzerdə açın: `http://localhost:3000`

---

## 6. Docker ilə İşə Salma

```bash
# Docker container-i qurun və arxa planda başladın
docker compose up -d --build

# Loqları izləyin
docker compose logs -f
```

---

## 7. VPS (Ubuntu/Debian) Deployment Təlimatı

### Addım 1: Server Asılılıqlarını Quraşdırın
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ffmpeg python3 python3-pip

# Node.js 22 LTS quraşdırın
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Addım 2: Layihəni Serverə Yerləşdirin
```bash
git clone https://github.com/your-username/saveaz-telegram-bot.git /opt/saveaz-bot
cd /opt/saveaz-bot

npm install
npm run build
```

### Addım 3: Systemd Servisi Yaradın
`/etc/systemd/system/saveaz-bot.service` faylını yaradın:
```ini
[Unit]
Description=Save.az Downloader Telegram Bot & Admin
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/saveaz-bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
EnvironmentFile=/opt/saveaz-bot/.env

[Install]
WantedBy=multi-user.target
```

Servisi aktivləşdirin:
```bash
sudo systemctl daemon-reload
sudo systemctl enable saveaz-bot
sudo systemctl start saveaz-bot
sudo systemctl status saveaz-bot
```

---

## 8. Nginx Reverse Proxy və SSL (Let's Encrypt)

### Nginx Konfiqurasiyası (save.az və /bot-admin yönləndirilməsi)

Əsas saytınız (`https://save.az`) mövcud veb tətbiqinizdə qalır, Telegram Bot Admin paneli isə ayrıca `/bot-admin` olaraq bu servisə yönləndirilir:

`/etc/nginx/sites-available/save.az`:
```nginx
server {
    server_name save.az www.save.az;

    # 1. Telegram Bot Admin Paneli və API (/bot-admin və /api/admin/*)
    location /bot-admin {
        proxy_pass http://127.0.0.1:3000/bot-admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/admin/ {
        proxy_pass http://127.0.0.1:3000/api/admin/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Əsas Public Sayt (heç bir login tələb olunmur)
    location / {
        proxy_pass http://127.0.0.1:3000; # və ya əsas Save.az backend portu
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Aktivləşdirin:
```bash
sudo ln -s /etc/nginx/sites-available/save.az /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Pulsuz SSL Alın
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d save.az -d www.save.az
```

---

## 9. Telegram Webhook Tənzimlənməsi

Production rejimində `.env` faylınızda:
```env
BOT_MODE=webhook
WEBHOOK_DOMAIN=https://bot.save.az
WEBHOOK_PATH=/telegram/webhook
WEBHOOK_SECRET=your-random-32-char-secret
```
Server işə düşdükdə Telegraf avtomatik olaraq Telegram API vasitəsilə webhook-u qeydiyyata alır.
Webhook statusunu əl ilə yoxlamaq üçün:
```bash
curl https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

---

## 10. Save.az Backend API İnteqrasiyası

Əsas media yükləmə prosesi üçün server birbaşa Save.az API-sinə qoşulur:
- `POST /api/analyze`: Sosial media URL-nin qəbulu və format metadata analizi.
- `POST /api/download`: Yükləmə sorğusunun qəbulu və jobId qaytarılması.
- `GET /api/download/:jobId/progress`: Canlı yükləmə faizi (0-100%) və hazır fayl linkinin izlənməsi.

Konfiqurasiya və schema detalları `src/services/saveAzApiClient.ts` faylındadır.

---

## 11. Təhlükəsizlik Yoxlama Siyahısı (Security Checklist)

- [x] **SSRF Qorunması**: `127.0.0.1`, `localhost`, `169.254.169.254` (cloud metadata) və bütün daxili şəbəkələr (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) bloklanır.
- [x] **Command Injection**: İstifadəçi linkləri birbaşa shell komandalarına ötürülmür; argument massivi və sanitizasiya tətbiq edilir.
- [x] **Rate Limiting**: Həm istifadəçi, həm də IP səviyyəsində dəqiqəlik limit tətbiq olunur.
- [x] **Token Maskalama**: Loqlarda Telegram bot tokeni və API açarları avtomatik `[REDACTED]` olaraq saxlanılır.
- [x] **Graceful Shutdown**: SIGINT və SIGTERM siqnalları qəbul edilərkən aktiv əlaqələr təmiz bağlanır.
