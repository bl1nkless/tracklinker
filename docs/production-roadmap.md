# TrackLinker Production Roadmap

## Текущая проблема

**BYO OAuth** (Bring Your Own) требует от каждого пользователя:
- Создавать Spotify Developer App
- Создавать Google Cloud Project
- Настраивать OAuth consent screens
- Копировать Client IDs

**Это неприемлемо для обычных пользователей.**

---

## Production-ready архитектура

### Цель
Пользователь приходит на сайт → нажимает "Connect Spotify" → авторизуется → готово.

### Что нужно изменить

```
┌─────────────┐
│   Frontend  │  (React, статический)
│  (Vercel)   │
└──────┬──────┘
       │
       │ HTTPS
       │
┌──────▼──────┐
│   Backend   │  (OAuth proxy + API)
│ (Serverless)│
└──────┬──────┘
       │
       ├──────► Spotify API
       ├──────► YouTube API
       └──────► Database (токены, плейлисты)
```

---

## Этап 1: Backend с единым OAuth

### Зачем?
- **Один** Spotify Client ID для всего приложения (ваш, не пользователя)
- **Один** Google Client ID для всего приложения
- Безопасное хранение токенов пользователей на сервере

### Технологии

**Вариант A: Serverless (Рекомендую для старта)**
- **Vercel Functions** (Node.js)
- **Supabase** (БД + Auth)
- Плюсы: Бесплатный тариф, быстрый деплой
- Минусы: Лимиты на бесплатном тарифе

**Вариант B: Традиционный сервер**
- **Node.js + Express**
- **PostgreSQL** (Railway, Supabase, Neon)
- **Deployed to**: Railway, Render, Fly.io
- Плюсы: Полный контроль
- Минусы: Нужно настраивать инфраструктуру

### Что делает backend?

1. **OAuth endpoints**:
   - `GET /api/auth/spotify` — редирект на Spotify
   - `GET /api/auth/spotify/callback` — обрабатывает код, сохраняет токен
   - `GET /api/auth/youtube` — редирект на Google
   - `GET /api/auth/youtube/callback` — обрабатывает код

2. **API endpoints** (проксирует запросы):
   - `GET /api/spotify/playlists` — получить плейлисты юзера
   - `POST /api/spotify/create-playlist` — создать плейлист
   - `GET /api/youtube/playlists` — получить плейлисты
   - `POST /api/youtube/create-playlist` — создать плейлист

3. **Хранение токенов**:
   - Session cookie (httpOnly, secure)
   - Database: `users` таблица с `spotify_token`, `youtube_token`

---

## Этап 2: Деплой

### Frontend

**Где:** Vercel / Netlify / GitHub Pages

**Шаги:**
1. `npm run build` — собрать production bundle
2. Загрузить на Vercel (подключить GitHub repo)
3. Получить домен: `tracklinker.vercel.app` (или свой)
4. **HTTPS работает автоматически** ✅

### Backend

**Где:** Vercel Functions (если Vercel) или Railway

**Шаги:**
1. Создать `/api` папку с функциями
2. Деплой вместе с frontend (Vercel) или отдельно (Railway)
3. Настроить environment variables:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

### База данных

**Где:** Supabase (бесплатно до определенного лимита)

**Схема:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  created_at TIMESTAMP
);
```

---

## Этап 3: Настройка Spotify App для Production

### 1. Spotify Developer Dashboard

- **Redirect URIs**: 
  - `https://tracklinker.vercel.app/api/auth/spotify/callback`
  - (Уже НЕ `http://localhost`)

### 2. Quota Extension Request

**Важно!** По умолчанию Spotify дает лимит **25 пользователей** в Development Mode.

Для production нужно:
1. Заполнить форму **Quota Extension** в Spotify Dashboard
2. Описать приложение, что оно делает
3. Приложить ссылку на задеплоенное приложение
4. **Обычно одобряют за 1-2 недели**

---

## Этап 4: Настройка Google Cloud для Production

### 1. OAuth Consent Screen

- Заполнить **все** поля (иконка, ссылки на Privacy Policy, Terms of Service)
- **Publishing status**: Перевести из "Testing" в "Production"
- **Verification**: Если запрашиваете чувствительные scopes (YouTube upload), нужно пройти verification от Google

### 2. Redirect URIs

- `https://tracklinker.vercel.app/api/auth/youtube/callback`

---

## Этап 5: UX улучшения

### Что добавить для пользователей:

1. **Onboarding**:
   - Приветственный экран "Что это приложение делает"
   - Один клик "Connect Spotify"

2. **Privacy Policy & Terms**:
   - Обязательно для Google verification
   - Можно сгенерировать через [TermsFeed](https://www.termsfeed.com/)

3. **Уведомления о статусе**:
   - "Синхронизация..." с прогресс баром
   - "Плейлист создан! Открыть в Spotify?"

4. **Обработка ошибок**:
   - Если токен истек → автоматически обновить через refresh token
   - Если трек не найден → показать список ненайденных

---

## Этап 6: Мониторинг и аналитика

- **Sentry** — отлов ошибок в production
- **Google Analytics** (или Plausible) — понимать, сколько пользователей
- **Logs** — логировать OAuth ошибки в backend

---

## Примерный timeline

| Этап | Время | Описание |
|------|-------|----------|
| **Backend OAuth flow** | 2-3 дня | Написать serverless functions для авторизации |
| **Database setup** | 1 день | Supabase + схема |
| **Frontend рефакторинг** | 2 дня | Переключить с BYO на backend API |
| **Деплой (staging)** | 1 день | Vercel + environment setup |
| **Privacy Policy / Terms** | 1 день | Написать или сгенерировать |
| **Spotify Quota Extension** | ~2 недели | Ждать одобрения |
| **Google OAuth Verification** | ~1-2 недели | Если нужно (для чувствительных scopes) |
| **Testing + Fixes** | 3-5 дней | Баги, UX полировка |
| **Production деплой** | 1 день | Финальный запуск |

**Всего:** ~1-1.5 месяца (с учетом ожиданий одобрений от Spotify/Google)

---

## Альтернатива: Упрощенная версия (без backend)

Если не хотите поддерживать сервер:

1. **Desktop app** (Electron):
   - OAuth работает локально
   - Не нужен backend
   - Можно распространять через GitHub Releases
   - Минус: Установка + обновления вручную

2. **Browser Extension**:
   - Работает прямо в браузере
   - OAuth через extension popup
   - Минус: Нужно публиковать в Chrome Web Store (ревью ~1-2 дня)

---

## Рекомендация

**Для MVP (Minimum Viable Product):**

1. Создайте **Vercel** проект
2. Добавьте **Vercel Functions** для OAuth
3. Используйте **Supabase** (бесплатно)
4. Задеплойте на `tracklinker.vercel.app`
5. Подайте запрос на Spotify Quota Extension
6. Пока ждете одобрения — полируйте UX

**Когда будет готово:**
- Пригласите друзей протестировать (в рамках 25 пользователей)
- Соберите feedback
- После одобрения от Spotify → открывайте для всех

---

## Нужна помощь?

Я могу помочь с:
- Написанием backend OAuth flow (Vercel Functions)
- Рефакторингом frontend под новую архитектуру
- Настройкой Supabase
- Деплоем на Vercel

Скажите, с чего хотите начать — и я помогу реализовать!
