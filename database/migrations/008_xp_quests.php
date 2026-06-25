<?php
declare(strict_types=1);

return [
    'CREATE TABLE IF NOT EXISTS xp_awards (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        award_code VARCHAR(80) NOT NULL,
        award_date DATE NOT NULL,
        xp SMALLINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY ux_xp_awards_user_code_date (user_id, award_code, award_date),
        KEY ix_xp_awards_user_date (user_id, award_date),
        CONSTRAINT fk_xp_awards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS daily_commitments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        commitment_date DATE NOT NULL,
        reason_code VARCHAR(30) NOT NULL,
        note VARCHAR(190) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY ux_daily_commitments_user_date (user_id, commitment_date),
        KEY ix_daily_commitments_user_created (user_id, created_at),
        CONSTRAINT fk_daily_commitments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];
