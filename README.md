# TrackLinker

Веб-приложение для переноса плейлистов из Spotify в YouTube Music с ручным сопоставлением треков.

## Возможности
- Перенос плейлистов Spotify → YouTube Music
- Поиск треков через Odesli API (улучшает матчинг)
- Ручное сопоставление, если автоматический поиск не нашёл нужный трек
- Прогресс и статистика переноса
- Хранение токенов авторизации в IndexedDB

## Стек
- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- Zustand
- TanStack Query
- IndexedDB (idb)

## Быстрый старт
1) Установить зависимости
```bash
npm install
```
2) Настроить ключи в приложении (кнопка ⚙️)
- Spotify Client ID — создать приложение в [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- Google Client ID — см. [docs/youtube-setup.md](docs/youtube-setup.md)
- Odesli API Key (опционально) — для улучшенного поиска треков
3) Запустить dev-сервер
```bash
npm run dev
```
Откроется `https://localhost:5173` (HTTPS обязателен для OAuth).

## Как пользоваться
1) Авторизуйтесь в Spotify и YouTube
2) Выберите плейлист Spotify для переноса
3) Проверьте сопоставление треков, при необходимости поправьте вручную
4) Запустите перенос — будет создан новый плейлист в YouTube Music

## Скрипты
| Команда           | Описание              |
| ----------------- | --------------------- |
| `npm run dev`     | Запуск dev-сервера    |
| `npm run build`   | Сборка для продакшена |
| `npm run preview` | Предпросмотр билда    |
| `npm run test`    | Запуск тестов         |
| `npm run lint`    | Проверка ESLint       |

## Структура проекта
```
src/
├── components/     # Общие UI-компоненты
├── core/           # Бизнес-логика (orchestrator, rate limiter)
├── features/       # Фичи по доменам
│   └── home/       # Главная страница
├── pages/          # Страницы приложения
├── providers/      # Адаптеры для Spotify/YouTube API
├── services/       # Внешние сервисы (Google Identity, Odesli)
└── store/          # Zustand сторы
```

## Документация
- [Настройка YouTube API](docs/youtube-setup.md)
- [План ручного тестирования](docs/manual-testing.md)
- [Roadmap](docs/production-roadmap.md)

## Лицензия
MIT
