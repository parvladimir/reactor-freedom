# REACTOR: Freedom

Серверное PWA-приложение на PHP 8.2+, MySQL/MariaDB, PDO, HTML, CSS и vanilla JavaScript. Приложение помогает вести контроль отказа от сигарет, алкоголя или обеих привычек: авторизация, пошаговый onboarding, dashboard, награды, журнал, инциденты, расчёт экономии и PWA-установка.

## Требования

- PHP 8.2 или новее
- MySQL 5.7+ / MariaDB 10.3+
- Расширения PHP: PDO, pdo_mysql, json, session
- Веб-сервер Apache/Nginx или обычный PHP-хостинг

## Установка базы данных

1. Создай пустую базу данных, например `reactor_freedom`.
2. Создай пользователя MySQL и дай ему права на эту базу.
3. Скопируй `.env.example` в `.env` и заполни:

```env
DB_HOST=127.0.0.1
DB_NAME=reactor_freedom
DB_USER=your_user
DB_PASS=your_password
APP_URL=https://example.com
APP_ENV=production
SESSION_NAME=reactor_session
SESSION_LIFETIME_DAYS=7
```

## Миграции и seed

Из корня проекта:

```bash
php scripts/migrate.php
php scripts/seed.php
```

`migrate.php` создаёт таблицы пользователей, профилей, привычек, целей, тяги, инцидентов, ежедневных отметок, наград, статистики, login rate limit и журнала. `seed.php` добавляет награды `spark`, `launch`, `control`, `iron`, `reactor`, `stark_mode`, `no_rollback`.

## Публикация на хостинг

Публичной должна быть только папка `public`. Если хостинг позволяет выбрать document root, укажи путь к `/public`.

Если document root изменить нельзя, загрузи проект так, чтобы URL открывал `public/index.php`, а приватные папки `app`, `config`, `database`, `scripts`, `storage`, `lang` не были доступны напрямую извне.

## Локальный запуск

```bash
php -S 127.0.0.1:8000 -t public
```

Открой `http://127.0.0.1:8000`.

## PWA

- Android: открой сайт в Chrome и выбери “Install app” / “Add to Home screen”.
- iPhone: открой сайт в Safari, нажми Share, затем “Add to Home Screen”.
- Service worker кэширует только статические файлы и offline fallback. API-ответы с приватными данными не кэшируются.

## Что реализовано

- Регистрация, вход, выход, PHP sessions, HttpOnly cookie
- `password_hash` / `password_verify`
- CSRF protection для POST API
- Login rate limit через таблицу `login_attempts`
- PDO prepared statements
- RU / EN / DE i18n с fallback на английский
- Пошаговый onboarding с сохранением в MySQL
- Dashboard только под выбранные привычки
- Расчёт clean time, reactor percent, статуса, XP, экономии и цели
- Craving emergency mode с 90-секундным таймером
- Инциденты без языка “провала”, сброс только нужной привычки
- Награды с сохранением и журналом событий
- Настройки без автоматического сброса прогресса
- Manifest, service worker, SVG icon и offline page
