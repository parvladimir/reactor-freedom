<?php
declare(strict_types=1);

return [
    'CREATE TABLE IF NOT EXISTS social_follows (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        follower_id INT UNSIGNED NOT NULL,
        following_id INT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE KEY ux_social_follows_pair (follower_id, following_id),
        KEY ix_social_follows_following (following_id, created_at),
        CONSTRAINT fk_social_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS social_reactions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        activity_log_id INT UNSIGNED NOT NULL,
        reaction_type VARCHAR(20) NOT NULL DEFAULT "like",
        created_at DATETIME NOT NULL,
        UNIQUE KEY ux_social_reactions_user_log_type (user_id, activity_log_id, reaction_type),
        KEY ix_social_reactions_log (activity_log_id, created_at),
        CONSTRAINT fk_social_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_reactions_log FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS social_supports (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sender_id INT UNSIGNED NOT NULL,
        recipient_id INT UNSIGNED NOT NULL,
        activity_log_id INT UNSIGNED NOT NULL,
        message VARCHAR(360) NOT NULL,
        created_at DATETIME NOT NULL,
        KEY ix_social_supports_log (activity_log_id, created_at),
        KEY ix_social_supports_recipient (recipient_id, created_at),
        CONSTRAINT fk_social_supports_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_supports_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_supports_log FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',

    'CREATE TABLE IF NOT EXISTS social_notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        actor_id INT UNSIGNED NOT NULL,
        activity_log_id INT UNSIGNED NULL,
        notification_type VARCHAR(30) NOT NULL,
        body VARCHAR(360) NULL,
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL,
        KEY ix_social_notifications_user_read (user_id, read_at, created_at),
        KEY ix_social_notifications_actor (actor_id, created_at),
        CONSTRAINT fk_social_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_notifications_log FOREIGN KEY (activity_log_id) REFERENCES activity_logs(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
];
