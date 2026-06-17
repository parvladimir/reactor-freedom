<?php
declare(strict_types=1);

return [
    'ALTER TABLE users
        ADD COLUMN email_verified_at DATETIME NULL AFTER language,
        ADD COLUMN marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verified_at,
        ADD COLUMN marketing_opt_in_at DATETIME NULL AFTER marketing_opt_in',

    'CREATE TABLE IF NOT EXISTS email_verifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        email VARCHAR(190) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        KEY ix_email_verifications_user (user_id),
        KEY ix_email_verifications_email (email),
        KEY ix_email_verifications_expires (expires_at),
        CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];
