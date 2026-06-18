<?php
declare(strict_types=1);

namespace Reactor\Repositories;

use DateTimeImmutable;
use PDO;

final class AppRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function ensureUserRecords(int $userId, string $language = 'en'): void
    {
        $profile = $this->pdo->prepare(
            'INSERT IGNORE INTO user_profiles (user_id, main_reason, custom_reason, currency, onboarding_completed, created_at, updated_at)
             VALUES (:user_id, "", NULL, "EUR", 0, NOW(), NOW())'
        );
        $profile->execute(['user_id' => $userId]);

        $stats = $this->pdo->prepare(
            'INSERT IGNORE INTO user_stats (user_id, xp, craving_wins, lifetime_smoke_clean_hours, lifetime_alcohol_clean_hours, created_at, updated_at)
             VALUES (:user_id, 0, 0, 0, 0, NOW(), NOW())'
        );
        $stats->execute(['user_id' => $userId]);
    }

    public function getProfile(int $userId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM user_profiles WHERE user_id = :user_id LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $profile = $stmt->fetch();

        return is_array($profile) ? $profile : null;
    }

    public function getHabits(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM habits WHERE user_id = :user_id AND is_active = 1 ORDER BY type');
        $stmt->execute(['user_id' => $userId]);

        $habits = [];
        foreach ($stmt->fetchAll() as $habit) {
            $habits[(string) $habit['type']] = $habit;
        }

        return $habits;
    }

    public function getGoal(int $userId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM goals WHERE user_id = :user_id ORDER BY id DESC LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $goal = $stmt->fetch();

        return is_array($goal) ? $goal : null;
    }

    public function getStats(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM user_stats WHERE user_id = :user_id LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $stats = $stmt->fetch();

        if (is_array($stats)) {
            return $stats;
        }

        $this->ensureUserRecords($userId);
        return $this->getStats($userId);
    }

    public function saveOnboarding(int $userId, array $data): void
    {
        $this->pdo->beginTransaction();

        try {
            $currency = $data['currency'] ?? 'EUR';
            $profile = $this->pdo->prepare(
                'INSERT INTO user_profiles (user_id, main_reason, custom_reason, currency, onboarding_completed, created_at, updated_at)
                 VALUES (:user_id, :main_reason, :custom_reason, :currency, 1, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE main_reason = VALUES(main_reason), custom_reason = VALUES(custom_reason),
                 currency = VALUES(currency), onboarding_completed = 1, updated_at = NOW()'
            );
            $profile->execute([
                'user_id' => $userId,
                'main_reason' => $data['main_reason'] ?? '',
                'custom_reason' => $data['custom_reason'] ?? null,
                'currency' => $currency,
            ]);

            $this->pdo->prepare('DELETE FROM habits WHERE user_id = :user_id')->execute(['user_id' => $userId]);
            $habitTypes = $data['habits'] ?? [];
            $insertHabit = $this->pdo->prepare(
                'INSERT INTO habits (
                    user_id, type, is_active, start_at, current_streak_start_at, cigarettes_per_day,
                    cigarettes_per_pack, pack_price, alcohol_weekly_spend, dangerous_days, created_at, updated_at
                 ) VALUES (
                    :user_id, :type, 1, NOW(), NOW(), :cigarettes_per_day,
                    :cigarettes_per_pack, :pack_price, :alcohol_weekly_spend, :dangerous_days, NOW(), NOW()
                 )'
            );

            foreach ($habitTypes as $type) {
                if (!in_array($type, ['smoking', 'alcohol'], true)) {
                    continue;
                }

                $insertHabit->execute([
                    'user_id' => $userId,
                    'type' => $type,
                    'cigarettes_per_day' => $type === 'smoking' ? $this->numberOrNull($data['cigarettes_per_day'] ?? null) : null,
                    'cigarettes_per_pack' => $type === 'smoking' ? $this->numberOrNull($data['cigarettes_per_pack'] ?? 20) : null,
                    'pack_price' => $type === 'smoking' ? $this->numberOrNull($data['pack_price'] ?? null) : null,
                    'alcohol_weekly_spend' => $type === 'alcohol' ? $this->numberOrNull($data['alcohol_weekly_spend'] ?? null) : null,
                    'dangerous_days' => $type === 'alcohol' ? json_encode($data['dangerous_days'] ?? [], JSON_UNESCAPED_UNICODE) : null,
                ]);
            }

            $this->pdo->prepare('DELETE FROM goals WHERE user_id = :user_id')->execute(['user_id' => $userId]);
            $goal = $this->pdo->prepare(
                'INSERT INTO goals (user_id, title, target_amount, currency, created_at, updated_at)
                 VALUES (:user_id, :title, :target_amount, :currency, NOW(), NOW())'
            );
            $goal->execute([
                'user_id' => $userId,
                'title' => $data['goal_title'] ?? '',
                'target_amount' => $this->numberOrNull($data['goal_amount'] ?? 0) ?? 0,
                'currency' => $currency,
            ]);

            $this->ensureUserRecords($userId);
            $this->addLog($userId, 'good', 'log.reactor_started', 'log.reactor_started_body');
            $this->pdo->commit();
        } catch (\Throwable $throwable) {
            $this->pdo->rollBack();
            throw $throwable;
        }
    }

    public function updateSettings(int $userId, array $data): void
    {
        $this->pdo->beginTransaction();

        try {
            $currency = $data['currency'] ?? 'EUR';
            $profile = $this->pdo->prepare(
                'UPDATE user_profiles SET currency = :currency, main_reason = :main_reason,
                 custom_reason = :custom_reason, updated_at = NOW() WHERE user_id = :user_id'
            );
            $profile->execute([
                'currency' => $currency,
                'main_reason' => $data['main_reason'] ?? '',
                'custom_reason' => $data['custom_reason'] ?? null,
                'user_id' => $userId,
            ]);

            $goal = $this->pdo->prepare(
                'UPDATE goals SET title = :title, target_amount = :target_amount, currency = :currency, updated_at = NOW()
                 WHERE user_id = :user_id ORDER BY id DESC LIMIT 1'
            );
            $goal->execute([
                'title' => $data['goal_title'] ?? '',
                'target_amount' => $this->numberOrNull($data['goal_amount'] ?? 0) ?? 0,
                'currency' => $currency,
                'user_id' => $userId,
            ]);

            if (isset($data['smoking'])) {
                $this->upsertHabitSettings($userId, 'smoking', $data['smoking']);
            }

            if (isset($data['alcohol'])) {
                $this->upsertHabitSettings($userId, 'alcohol', $data['alcohol']);
            }

            if (($data['reset_progress'] ?? false) === true && ($data['confirm_reset'] ?? '') === 'RESET') {
                $this->pdo->prepare(
                    'UPDATE habits SET start_at = NOW(), current_streak_start_at = NOW(), updated_at = NOW()
                     WHERE user_id = :user_id AND is_active = 1'
                )->execute(['user_id' => $userId]);
                $this->addLog($userId, 'bad', 'log.progress_reset', 'log.progress_reset_body');
            }

            $this->pdo->commit();
        } catch (\Throwable $throwable) {
            $this->pdo->rollBack();
            throw $throwable;
        }
    }

    public function saveCheckin(int $userId, bool $smokeClean, bool $alcoholClean): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO daily_checkins (user_id, checkin_date, smoke_clean, alcohol_clean, created_at, updated_at)
             VALUES (:user_id, CURDATE(), :smoke_clean, :alcohol_clean, NOW(), NOW())
             ON DUPLICATE KEY UPDATE smoke_clean = GREATEST(smoke_clean, VALUES(smoke_clean)),
             alcohol_clean = GREATEST(alcohol_clean, VALUES(alcohol_clean)), updated_at = NOW()'
        );
        $stmt->execute([
            'user_id' => $userId,
            'smoke_clean' => $smokeClean ? 1 : 0,
            'alcohol_clean' => $alcoholClean ? 1 : 0,
        ]);

        $this->pdo->prepare('UPDATE user_stats SET xp = xp + 10, updated_at = NOW() WHERE user_id = :user_id')
            ->execute(['user_id' => $userId]);
        $this->addLog($userId, 'good', 'log.checkin_saved', 'log.checkin_saved_body');
    }

    public function getTodayCheckin(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM daily_checkins WHERE user_id = :user_id AND checkin_date = CURDATE() LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $checkin = $stmt->fetch();

        return is_array($checkin) ? $checkin : ['smoke_clean' => 0, 'alcohol_clean' => 0];
    }

    public function dailyCheckinsLastDays(int $userId, int $days = 7): array
    {
        $days = max(1, min(90, $days));
        $stmt = $this->pdo->prepare(
            "SELECT * FROM daily_checkins
             WHERE user_id = :user_id AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL {$days} DAY)
             ORDER BY checkin_date DESC"
        );
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll();
    }

    public function startCraving(int $userId, ?string $habitType): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO cravings (user_id, habit_type, reason, rescue_action, completed, created_at, completed_at)
             VALUES (:user_id, :habit_type, "", "", 0, NOW(), NULL)'
        );
        $stmt->execute(['user_id' => $userId, 'habit_type' => $habitType]);

        return (int) $this->pdo->lastInsertId();
    }

    public function completeCraving(int $userId, ?int $cravingId, ?string $habitType, string $reason, string $rescueAction): void
    {
        $this->pdo->beginTransaction();

        try {
            if ($cravingId !== null) {
                $stmt = $this->pdo->prepare(
                    'UPDATE cravings SET habit_type = :habit_type, reason = :reason, rescue_action = :rescue_action,
                     completed = 1, completed_at = NOW() WHERE id = :id AND user_id = :user_id'
                );
                $stmt->execute([
                    'habit_type' => $habitType,
                    'reason' => $reason,
                    'rescue_action' => $rescueAction,
                    'id' => $cravingId,
                    'user_id' => $userId,
                ]);
            } else {
                $stmt = $this->pdo->prepare(
                    'INSERT INTO cravings (user_id, habit_type, reason, rescue_action, completed, created_at, completed_at)
                     VALUES (:user_id, :habit_type, :reason, :rescue_action, 1, NOW(), NOW())'
                );
                $stmt->execute([
                    'user_id' => $userId,
                    'habit_type' => $habitType,
                    'reason' => $reason,
                    'rescue_action' => $rescueAction,
                ]);
            }

            $this->pdo->prepare(
                'UPDATE user_stats SET xp = xp + 35, craving_wins = craving_wins + 1, updated_at = NOW()
                 WHERE user_id = :user_id'
            )->execute(['user_id' => $userId]);
            $this->addLog($userId, 'good', 'log.craving_completed', $reason . ' / ' . $rescueAction);
            $this->pdo->commit();
        } catch (\Throwable $throwable) {
            $this->pdo->rollBack();
            throw $throwable;
        }
    }

    public function completedCravingsToday(int $userId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM cravings
             WHERE user_id = :user_id AND completed = 1 AND DATE(completed_at) = CURDATE()'
        );
        $stmt->execute(['user_id' => $userId]);

        return (int) $stmt->fetchColumn();
    }

    public function triggerEventsToday(int $userId): int
    {
        $cravings = $this->pdo->prepare(
            'SELECT COUNT(*) FROM cravings
             WHERE user_id = :user_id AND reason <> "" AND DATE(COALESCE(completed_at, created_at)) = CURDATE()'
        );
        $cravings->execute(['user_id' => $userId]);

        $incidents = $this->pdo->prepare(
            'SELECT COUNT(*) FROM incidents WHERE user_id = :user_id AND DATE(created_at) = CURDATE()'
        );
        $incidents->execute(['user_id' => $userId]);

        return (int) $cravings->fetchColumn() + (int) $incidents->fetchColumn();
    }

    public function cravingsLastDays(int $userId, int $days = 7): array
    {
        $days = max(1, min(90, $days));
        $stmt = $this->pdo->prepare(
            "SELECT id, habit_type, reason, rescue_action, completed, created_at, completed_at
             FROM cravings
             WHERE user_id = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
             ORDER BY created_at DESC, id DESC"
        );
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll();
    }

    public function incidentsLastDays(int $userId, int $days = 7): array
    {
        $days = max(1, min(90, $days));
        $stmt = $this->pdo->prepare(
            "SELECT id, habit_type, note, created_at
             FROM incidents
             WHERE user_id = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL {$days} DAY)
             ORDER BY created_at DESC, id DESC"
        );
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll();
    }

    public function saveIncident(int $userId, string $habitType, string $note): void
    {
        $this->pdo->beginTransaction();

        try {
            $habit = $this->habitByType($userId, $habitType);
            if ($habit !== null) {
                $hours = $this->hoursSince((string) $habit['current_streak_start_at']);
                $field = $habitType === 'smoking' ? 'lifetime_smoke_clean_hours' : 'lifetime_alcohol_clean_hours';
                $this->pdo->prepare(
                    "UPDATE user_stats SET {$field} = {$field} + :hours, xp = GREATEST(xp - 25, 0), updated_at = NOW()
                     WHERE user_id = :user_id"
                )->execute(['hours' => $hours, 'user_id' => $userId]);

                $this->pdo->prepare(
                    'UPDATE habits SET current_streak_start_at = NOW(), updated_at = NOW()
                     WHERE user_id = :user_id AND type = :type'
                )->execute(['user_id' => $userId, 'type' => $habitType]);
            }

            $stmt = $this->pdo->prepare(
                'INSERT INTO incidents (user_id, habit_type, note, created_at)
                 VALUES (:user_id, :habit_type, :note, NOW())'
            );
            $stmt->execute(['user_id' => $userId, 'habit_type' => $habitType, 'note' => $note]);
            $this->addLog($userId, 'bad', 'log.incident_saved', 'log.incident_saved_body');
            $this->pdo->commit();
        } catch (\Throwable $throwable) {
            $this->pdo->rollBack();
            throw $throwable;
        }
    }

    public function rewards(): array
    {
        return $this->pdo->query('SELECT * FROM rewards ORDER BY required_hours ASC')->fetchAll();
    }

    public function userRewardCodes(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT rewards.code FROM user_rewards
             INNER JOIN rewards ON rewards.id = user_rewards.reward_id
             WHERE user_rewards.user_id = :user_id'
        );
        $stmt->execute(['user_id' => $userId]);

        return array_map(static fn (array $row): string => (string) $row['code'], $stmt->fetchAll());
    }

    public function unlockRewards(int $userId, float $controlHours): array
    {
        $existing = array_flip($this->userRewardCodes($userId));
        $unlockedNow = [];

        foreach ($this->rewards() as $reward) {
            if ((float) $reward['required_hours'] > $controlHours || isset($existing[$reward['code']])) {
                continue;
            }

            $stmt = $this->pdo->prepare(
                'INSERT IGNORE INTO user_rewards (user_id, reward_id, unlocked_at)
                 VALUES (:user_id, :reward_id, NOW())'
            );
            $stmt->execute(['user_id' => $userId, 'reward_id' => $reward['id']]);
            $unlockedNow[] = $reward;
            $this->addLog($userId, 'good', 'log.reward_unlocked', (string) $reward['title_key']);
        }

        return $unlockedNow;
    }

    public function logs(int $userId, int $limit = 60): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM activity_logs WHERE user_id = :user_id ORDER BY created_at DESC, id DESC LIMIT :limit'
        );
        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    public function addLog(int $userId, string $type, string $titleKey, string $body = ''): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO activity_logs (user_id, type, title_key, body, created_at)
             VALUES (:user_id, :type, :title_key, :body, NOW())'
        );
        $stmt->execute([
            'user_id' => $userId,
            'type' => $type,
            'title_key' => $titleKey,
            'body' => $body,
        ]);
    }

    public function countRecentLoginAttempts(string $email, string $ipAddress, int $minutes = 15): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM login_attempts
             WHERE email = :email AND ip_address = :ip_address AND attempted_at > DATE_SUB(NOW(), INTERVAL :minutes MINUTE)'
        );
        $stmt->bindValue('email', strtolower($email));
        $stmt->bindValue('ip_address', $ipAddress);
        $stmt->bindValue('minutes', $minutes, PDO::PARAM_INT);
        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    public function recordLoginAttempt(string $email, string $ipAddress): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO login_attempts (email, ip_address, attempted_at)
             VALUES (:email, :ip_address, NOW())'
        );
        $stmt->execute(['email' => strtolower($email), 'ip_address' => $ipAddress]);
    }

    public function clearLoginAttempts(string $email, string $ipAddress): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM login_attempts WHERE email = :email AND ip_address = :ip_address');
        $stmt->execute(['email' => strtolower($email), 'ip_address' => $ipAddress]);
    }

    private function upsertHabitSettings(int $userId, string $type, array $data): void
    {
        $dangerousDays = $type === 'alcohol' ? json_encode($data['dangerous_days'] ?? [], JSON_UNESCAPED_UNICODE) : null;
        $stmt = $this->pdo->prepare(
            'INSERT INTO habits (
                user_id, type, is_active, start_at, current_streak_start_at, cigarettes_per_day,
                cigarettes_per_pack, pack_price, alcohol_weekly_spend, dangerous_days, created_at, updated_at
             ) VALUES (
                :user_id, :type, :is_active, NOW(), NOW(), :cigarettes_per_day,
                :cigarettes_per_pack, :pack_price, :alcohol_weekly_spend, :dangerous_days, NOW(), NOW()
             ) ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), cigarettes_per_day = VALUES(cigarettes_per_day),
             cigarettes_per_pack = VALUES(cigarettes_per_pack), pack_price = VALUES(pack_price),
             alcohol_weekly_spend = VALUES(alcohol_weekly_spend), dangerous_days = VALUES(dangerous_days), updated_at = NOW()'
        );
        $stmt->execute([
            'user_id' => $userId,
            'type' => $type,
            'is_active' => !empty($data['is_active']) ? 1 : 0,
            'cigarettes_per_day' => $type === 'smoking' ? $this->numberOrNull($data['cigarettes_per_day'] ?? null) : null,
            'cigarettes_per_pack' => $type === 'smoking' ? $this->numberOrNull($data['cigarettes_per_pack'] ?? 20) : null,
            'pack_price' => $type === 'smoking' ? $this->numberOrNull($data['pack_price'] ?? null) : null,
            'alcohol_weekly_spend' => $type === 'alcohol' ? $this->numberOrNull($data['alcohol_weekly_spend'] ?? null) : null,
            'dangerous_days' => $dangerousDays,
        ]);
    }

    private function habitByType(int $userId, string $type): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM habits WHERE user_id = :user_id AND type = :type LIMIT 1');
        $stmt->execute(['user_id' => $userId, 'type' => $type]);
        $habit = $stmt->fetch();

        return is_array($habit) ? $habit : null;
    }

    private function hoursSince(string $date): float
    {
        $start = new DateTimeImmutable($date);
        return max(0, (time() - $start->getTimestamp()) / 3600);
    }

    private function numberOrNull(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }
}
