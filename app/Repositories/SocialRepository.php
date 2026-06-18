<?php
declare(strict_types=1);

namespace Reactor\Repositories;

use PDO;

final class SocialRepository
{
    private const PUBLIC_LOG_KEYS = [
        'log.checkin_saved',
        'log.craving_completed',
        'log.reward_unlocked',
    ];

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function summary(int $userId): array
    {
        return [
            'feed' => $this->feed($userId),
            'following' => $this->following($userId),
            'followers' => $this->followers($userId),
            'notifications' => $this->notifications($userId),
            'unread_count' => $this->unreadCount($userId),
        ];
    }

    public function searchUsers(int $userId, string $query, int $limit = 12): array
    {
        $query = trim($query);
        if ($this->textLength($query) < 2) {
            return [];
        }

        $term = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $query) . '%';
        $stmt = $this->pdo->prepare(
            'SELECT users.id, users.name, users.email,
                    EXISTS(
                        SELECT 1 FROM social_follows
                        WHERE social_follows.follower_id = :viewer_id
                          AND social_follows.following_id = users.id
                    ) AS is_following
             FROM users
             WHERE users.id <> :user_id
               AND users.email_verified_at IS NOT NULL
               AND (users.name LIKE :term OR users.email LIKE :term)
             ORDER BY users.name ASC
             LIMIT :limit'
        );
        $stmt->bindValue('viewer_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('term', $term);
        $stmt->bindValue('limit', max(1, min(25, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return array_map(fn (array $user): array => $this->publicUser($user), $stmt->fetchAll());
    }

    public function follow(int $followerId, int $followingId): void
    {
        if ($followerId === $followingId || !$this->userExists($followingId)) {
            return;
        }

        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO social_follows (follower_id, following_id, created_at)
             VALUES (:follower_id, :following_id, NOW())'
        );
        $stmt->execute(['follower_id' => $followerId, 'following_id' => $followingId]);

        if ($stmt->rowCount() > 0) {
            $this->notify($followingId, $followerId, null, 'follow');
        }
    }

    public function unfollow(int $followerId, int $followingId): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM social_follows WHERE follower_id = :follower_id AND following_id = :following_id'
        );
        $stmt->execute(['follower_id' => $followerId, 'following_id' => $followingId]);
    }

    public function like(int $actorId, int $activityLogId): void
    {
        $event = $this->publicEventById($activityLogId);
        if ($event === null) {
            return;
        }

        $stmt = $this->pdo->prepare(
            'INSERT IGNORE INTO social_reactions (user_id, activity_log_id, reaction_type, created_at)
             VALUES (:user_id, :activity_log_id, "like", NOW())'
        );
        $stmt->execute(['user_id' => $actorId, 'activity_log_id' => $activityLogId]);

        $ownerId = (int) $event['user_id'];
        if ($stmt->rowCount() > 0 && $ownerId !== $actorId) {
            $this->notify($ownerId, $actorId, $activityLogId, 'like');
        }
    }

    public function support(int $actorId, int $activityLogId, string $message): void
    {
        $event = $this->publicEventById($activityLogId);
        $message = trim($this->textLimit($message, 300));
        if ($event === null || $message === '') {
            return;
        }

        $ownerId = (int) $event['user_id'];
        $stmt = $this->pdo->prepare(
            'INSERT INTO social_supports (sender_id, recipient_id, activity_log_id, message, created_at)
             VALUES (:sender_id, :recipient_id, :activity_log_id, :message, NOW())'
        );
        $stmt->execute([
            'sender_id' => $actorId,
            'recipient_id' => $ownerId,
            'activity_log_id' => $activityLogId,
            'message' => $message,
        ]);

        if ($ownerId !== $actorId) {
            $this->notify($ownerId, $actorId, $activityLogId, 'support', $message);
        }
    }

    public function markNotificationsRead(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE social_notifications SET read_at = NOW()
             WHERE user_id = :user_id AND read_at IS NULL'
        );
        $stmt->execute(['user_id' => $userId]);
    }

    public function feed(int $userId, int $limit = 40): array
    {
        $keys = $this->publicKeysPlaceholders();
        $stmt = $this->pdo->prepare(
            "SELECT activity_logs.id, activity_logs.user_id, activity_logs.type, activity_logs.title_key,
                    activity_logs.body, activity_logs.created_at, users.name, users.email,
                    (SELECT COUNT(*) FROM social_reactions WHERE social_reactions.activity_log_id = activity_logs.id) AS likes_count,
                    EXISTS(
                        SELECT 1 FROM social_reactions
                        WHERE social_reactions.activity_log_id = activity_logs.id
                          AND social_reactions.user_id = :viewer_like_id
                    ) AS liked_by_me,
                    (SELECT COUNT(*) FROM social_supports WHERE social_supports.activity_log_id = activity_logs.id) AS supports_count
             FROM activity_logs
             INNER JOIN users ON users.id = activity_logs.user_id
             WHERE activity_logs.title_key IN ({$keys})
               AND (
                    activity_logs.user_id = :viewer_id
                    OR EXISTS(
                        SELECT 1 FROM social_follows
                        WHERE social_follows.follower_id = :viewer_follow_id
                          AND social_follows.following_id = activity_logs.user_id
                    )
               )
             ORDER BY activity_logs.created_at DESC, activity_logs.id DESC
             LIMIT :limit"
        );
        $stmt->bindValue('viewer_like_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('viewer_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('viewer_follow_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('limit', max(1, min(80, $limit)), PDO::PARAM_INT);
        $this->bindPublicKeys($stmt);
        $stmt->execute();

        return array_map(fn (array $event): array => $this->decorateEvent($event), $stmt->fetchAll());
    }

    public function following(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT users.id, users.name, users.email, social_follows.created_at AS followed_at
             FROM social_follows
             INNER JOIN users ON users.id = social_follows.following_id
             WHERE social_follows.follower_id = :user_id
             ORDER BY social_follows.created_at DESC'
        );
        $stmt->execute(['user_id' => $userId]);

        return array_map(fn (array $user): array => $this->publicUser($user), $stmt->fetchAll());
    }

    public function followers(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT users.id, users.name, users.email, social_follows.created_at AS followed_at,
                    EXISTS(
                        SELECT 1 FROM social_follows mine
                        WHERE mine.follower_id = :viewer_id AND mine.following_id = users.id
                    ) AS is_following
             FROM social_follows
             INNER JOIN users ON users.id = social_follows.follower_id
             WHERE social_follows.following_id = :user_id
             ORDER BY social_follows.created_at DESC'
        );
        $stmt->execute(['viewer_id' => $userId, 'user_id' => $userId]);

        return array_map(fn (array $user): array => $this->publicUser($user), $stmt->fetchAll());
    }

    public function notifications(int $userId, int $limit = 30): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT social_notifications.*, users.name AS actor_name, users.email AS actor_email,
                    activity_logs.title_key, activity_logs.body AS event_body
             FROM social_notifications
             INNER JOIN users ON users.id = social_notifications.actor_id
             LEFT JOIN activity_logs ON activity_logs.id = social_notifications.activity_log_id
             WHERE social_notifications.user_id = :user_id
             ORDER BY social_notifications.created_at DESC, social_notifications.id DESC
             LIMIT :limit'
        );
        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('limit', max(1, min(80, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return array_map(static fn (array $notification): array => [
            'id' => (int) $notification['id'],
            'type' => (string) $notification['notification_type'],
            'body' => (string) ($notification['body'] ?? ''),
            'read' => $notification['read_at'] !== null,
            'created_at' => $notification['created_at'],
            'actor' => [
                'id' => (int) $notification['actor_id'],
                'name' => $notification['actor_name'],
                'email' => $notification['actor_email'],
            ],
            'event' => $notification['activity_log_id'] === null ? null : [
                'id' => (int) $notification['activity_log_id'],
                'title_key' => $notification['title_key'],
                'body' => $notification['event_body'] ?? '',
            ],
        ], $stmt->fetchAll());
    }

    public function unreadCount(int $userId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM social_notifications WHERE user_id = :user_id AND read_at IS NULL'
        );
        $stmt->execute(['user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    private function notify(int $userId, int $actorId, ?int $activityLogId, string $type, string $body = ''): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO social_notifications (user_id, actor_id, activity_log_id, notification_type, body, read_at, created_at)
             VALUES (:user_id, :actor_id, :activity_log_id, :notification_type, :body, NULL, NOW())'
        );
        $stmt->execute([
            'user_id' => $userId,
            'actor_id' => $actorId,
            'activity_log_id' => $activityLogId,
            'notification_type' => $type,
            'body' => $body,
        ]);
    }

    private function publicEventById(int $activityLogId): ?array
    {
        $keys = $this->publicKeysPlaceholders();
        $stmt = $this->pdo->prepare(
            "SELECT * FROM activity_logs WHERE id = :id AND title_key IN ({$keys}) LIMIT 1"
        );
        $stmt->bindValue('id', $activityLogId, PDO::PARAM_INT);
        $this->bindPublicKeys($stmt);
        $stmt->execute();
        $event = $stmt->fetch();

        return is_array($event) ? $event : null;
    }

    private function userExists(int $userId): bool
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM users WHERE id = :id AND email_verified_at IS NOT NULL');
        $stmt->execute(['id' => $userId]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function decorateEvent(array $event): array
    {
        return [
            'id' => (int) $event['id'],
            'type' => $event['type'],
            'title_key' => $event['title_key'],
            'body' => $event['body'] ?? '',
            'created_at' => $event['created_at'],
            'likes_count' => (int) $event['likes_count'],
            'supports_count' => (int) $event['supports_count'],
            'liked_by_me' => (bool) $event['liked_by_me'],
            'user' => [
                'id' => (int) $event['user_id'],
                'name' => $event['name'],
                'email' => $event['email'],
            ],
        ];
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'is_following' => (bool) ($user['is_following'] ?? false),
            'followed_at' => $user['followed_at'] ?? null,
        ];
    }

    private function publicKeysPlaceholders(): string
    {
        return implode(', ', array_map(static fn (int $index): string => ':key' . $index, array_keys(self::PUBLIC_LOG_KEYS)));
    }

    private function bindPublicKeys(\PDOStatement $stmt): void
    {
        foreach (self::PUBLIC_LOG_KEYS as $index => $key) {
            $stmt->bindValue('key' . $index, $key);
        }
    }

    private function textLength(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    }

    private function textLimit(string $value, int $limit): string
    {
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
    }
}
