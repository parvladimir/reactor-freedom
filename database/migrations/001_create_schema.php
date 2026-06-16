<?php
declare(strict_types=1);

return [
    'CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        language VARCHAR(5) NOT NULL DEFAULT "en",
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS user_profiles (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        main_reason VARCHAR(80) NOT NULL DEFAULT "",
        custom_reason VARCHAR(190) NULL,
        currency VARCHAR(8) NOT NULL DEFAULT "EUR",
        onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS habits (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        type ENUM("smoking","alcohol") NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        start_at DATETIME NOT NULL,
        current_streak_start_at DATETIME NOT NULL,
        cigarettes_per_day DECIMAL(8,2) NULL,
        cigarettes_per_pack DECIMAL(8,2) NULL,
        pack_price DECIMAL(10,2) NULL,
        alcohol_weekly_spend DECIMAL(10,2) NULL,
        dangerous_days JSON NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY ux_habits_user_type (user_id, type),
        KEY ix_habits_user_active (user_id, is_active),
        CONSTRAINT fk_habits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS goals (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(190) NOT NULL,
        target_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(8) NOT NULL DEFAULT "EUR",
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        KEY ix_goals_user (user_id),
        CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS cravings (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        habit_type ENUM("smoking","alcohol") NULL,
        reason VARCHAR(120) NOT NULL DEFAULT "",
        rescue_action VARCHAR(255) NOT NULL DEFAULT "",
        completed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        KEY ix_cravings_user_created (user_id, created_at),
        CONSTRAINT fk_cravings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS incidents (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        habit_type ENUM("smoking","alcohol") NOT NULL,
        note TEXT NULL,
        created_at DATETIME NOT NULL,
        KEY ix_incidents_user_created (user_id, created_at),
        CONSTRAINT fk_incidents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS daily_checkins (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        checkin_date DATE NOT NULL,
        smoke_clean TINYINT(1) NOT NULL DEFAULT 0,
        alcohol_clean TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY ux_daily_checkins_user_date (user_id, checkin_date),
        CONSTRAINT fk_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS rewards (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(80) NOT NULL UNIQUE,
        title_key VARCHAR(120) NOT NULL,
        description_key VARCHAR(160) NOT NULL,
        required_hours INT UNSIGNED NOT NULL,
        rarity VARCHAR(40) NOT NULL,
        reward_type VARCHAR(40) NOT NULL,
        created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS user_rewards (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        reward_id INT UNSIGNED NOT NULL,
        unlocked_at DATETIME NOT NULL,
        UNIQUE KEY ux_user_rewards (user_id, reward_id),
        CONSTRAINT fk_user_rewards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_rewards_reward FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS user_stats (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        xp INT UNSIGNED NOT NULL DEFAULT 0,
        craving_wins INT UNSIGNED NOT NULL DEFAULT 0,
        lifetime_smoke_clean_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
        lifetime_alcohol_clean_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS login_attempts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL,
        ip_address VARCHAR(64) NOT NULL,
        attempted_at DATETIME NOT NULL,
        KEY ix_login_attempts_email_ip_time (email, ip_address, attempted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS activity_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT "info",
        title_key VARCHAR(160) NOT NULL,
        body TEXT NULL,
        created_at DATETIME NOT NULL,
        KEY ix_activity_logs_user_created (user_id, created_at),
        CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];
