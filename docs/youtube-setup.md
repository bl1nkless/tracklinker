# Настройка Google Client ID для YouTube

Чтобы приложение могло создавать плейлисты и добавлять треки в ваш YouTube аккаунт, нужно получить **Client ID**.

## Шаг 1: Создание проекта в Google Cloud Console

1.  Перейдите в [Google Cloud Console](https://console.cloud.google.com/).
2.  Нажмите на выпадающий список проектов вверху слева (рядом с логотипом Google Cloud).
3.  Нажмите **New Project** (Создать проект).
4.  Введите имя проекта (например, `TrackLinker`) и нажмите **Create**.

## Шаг 2: Включение YouTube Data API v3

1.  В меню слева выберите **APIs & Services** -> **Library**.
2.  В строке поиска введите `YouTube Data API v3`.
3.  Выберите его из списка и нажмите кнопку **Enable** (Включить).

## Шаг 3: Настройка экрана согласия (OAuth Consent Screen)

В меню слева выберите **APIs & Services** -> **OAuth consent screen**.
В новом интерфейсе настройка разделена на вкладки:

### 1. Вкладка "Branding" (Брендинг)
*   **App name**: Введите `TrackLinker`.
*   **User support email**: Выберите свой email.
*   **Developer contact information**: Введите свой email.
*   Нажмите **Save**.

### 2. Вкладка "Data Access" (Доступ к данным)
*   Нажмите кнопку **Add or Remove Scopes**.
*   Найдите и выберите галочками:
    *   `.../auth/youtube` (Manage your YouTube account)
    *   `.../auth/youtube.force-ssl` (See, edit, and permanently delete your YouTube videos...)
*   **Если их нет в списке**:
    1.  В этом же окне найдите раздел "Manually add scopes".
    2.  Вставьте туда эти ссылки:
        *   `https://www.googleapis.com/auth/youtube`
        *   `https://www.googleapis.com/auth/youtube.force-ssl`
    3.  Нажмите **Add to table**.
*   Нажмите **Update**, затем **Save**.

### 3. Вкладка "Audience" (Аудитория)
*   Прокрутите вниз до раздела **Test Users**.
*   Нажмите **Add Users**.
*   Введите **свой email** (тот, под которым будете входить в YouTube).
*   **Важно:** Без этого вы не сможете войти, пока приложение в статусе "Testing".
*   Нажмите **Save**.

## Шаг 4: Создание Client ID

1.  В меню слева выберите **APIs & Services** -> **Clients** (или **Credentials**).
2.  Нажмите **Create Client** (или **Create Credentials** -> **OAuth client ID**).
3.  **Application type**: выберите **Web application**.
4.  **Name**: `TrackLinker Web Client`.
5.  **Authorized JavaScript origins**:
    *   Нажмите **Add URI**.
    *   Введите: `http://localhost:5173`
    *   Добавьте еще один: `http://127.0.0.1:5173`
6.  **Authorized redirect URIs**:
    *   Нажмите **Add URI**.
    *   Введите: `http://localhost:5173`
    *   Добавьте еще один: `http://127.0.0.1:5173`
7.  Нажмите **Create**.

## Шаг 5: Копирование Client ID

1.  Появится окно с вашим **Client ID**.
2.  Скопируйте строку, которая выглядит примерно так: `123456789-abcde...apps.googleusercontent.com`.
3.  Вставьте этот ID в настройки приложения TrackLinker (кнопка шестеренки -> Google Client ID).
