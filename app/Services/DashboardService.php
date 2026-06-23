<?php
declare(strict_types=1);

namespace Reactor\Services;

use DateTimeImmutable;
use Reactor\Repositories\AppRepository;

final class DashboardService
{
    private const REWARD_CATALOG = [
        ['code' => 'coffee', 'amount' => 4, 'title_key' => 'treats.coffee'],
        ['code' => 'cinema', 'amount' => 14, 'title_key' => 'treats.cinema'],
        ['code' => 'dinner', 'amount' => 22, 'title_key' => 'treats.dinner'],
        ['code' => 'child_gift', 'amount' => 35, 'title_key' => 'treats.child_gift'],
        ['code' => 'clothes', 'amount' => 60, 'title_key' => 'treats.clothes'],
        ['code' => 'tech', 'amount' => 120, 'title_key' => 'treats.tech'],
        ['code' => 'trip', 'amount' => 300, 'title_key' => 'treats.trip'],
    ];

    private const LEVELS = [
        ['code' => 'spark', 'xp' => 0],
        ['code' => 'focus', 'xp' => 100],
        ['code' => 'rhythm', 'xp' => 250],
        ['code' => 'resilience', 'xp' => 500],
        ['code' => 'clarity', 'xp' => 850],
        ['code' => 'momentum', 'xp' => 1300],
        ['code' => 'freedom', 'xp' => 2000],
    ];

    public function __construct(private readonly AppRepository $repository)
    {
    }

    public function build(array $user): array
    {
        $userId = (int) $user['id'];
        $this->repository->ensureUserRecords($userId, (string) $user['language']);

        $profile = $this->repository->getProfile($userId);
        $habits = $this->repository->getHabits($userId);
        $goal = $this->repository->getGoal($userId);
        $stats = $this->repository->getStats($userId);
        $controlHours = $this->controlHours($habits);
        $unlockedNow = $this->repository->unlockRewards($userId, $controlHours);
        $rewardCodes = array_flip($this->repository->userRewardCodes($userId));
        $rewards = $this->decorateRewards($this->repository->rewards(), $rewardCodes);
        $money = $this->money($habits, $goal);
        $todayCheckin = $this->repository->getTodayCheckin($userId);
        $completedCravingsToday = $this->repository->completedCravingsToday($userId);
        $triggerEventsToday = $this->repository->triggerEventsToday($userId);
        $recentCravings = $this->repository->cravingsLastDays($userId, 7);
        $recentIncidents = $this->repository->incidentsLastDays($userId, 7);
        $recentCheckins = $this->repository->dailyCheckinsLastDays($userId, 7);
        $missions = $this->dailyMissions($habits, $todayCheckin, $completedCravingsToday, $triggerEventsToday);
        $triggerMap = $this->triggerMap($recentCravings, $recentIncidents);

        return [
            'user' => [
                'id' => $userId,
                'name' => $user['name'],
                'email' => $user['email'],
                'language' => $user['language'],
                'avatar_code' => $user['avatar_code'] ?? 'pulse',
                'has_avatar' => (bool) ($user['has_avatar'] ?? false),
            ],
            'profile' => $profile,
            'onboarding_completed' => (bool) ($profile['onboarding_completed'] ?? false),
            'habits' => $this->decorateHabits($habits),
            'habit_types' => array_values(array_keys($habits)),
            'stats' => [
                'xp' => (int) ($stats['xp'] ?? 0),
                'craving_wins' => (int) ($stats['craving_wins'] ?? 0),
                'lifetime_smoke_clean_hours' => (float) ($stats['lifetime_smoke_clean_hours'] ?? 0),
                'lifetime_alcohol_clean_hours' => (float) ($stats['lifetime_alcohol_clean_hours'] ?? 0),
            ],
            'progression' => $this->progression((int) ($stats['xp'] ?? 0)),
            'reactor' => [
                'control_hours' => round($controlHours, 2),
                'control_days' => floor($controlHours / 24),
                'percent' => $this->reactorPercent($controlHours, $rewards),
                'status_key' => $this->statusKey($controlHours),
                'level_key' => $this->levelKey($controlHours, $rewards),
                'next_reward' => $this->nextReward($controlHours, $rewards),
            ],
            'money' => $money,
            'today_checkin' => [
                'smoke_clean' => (bool) ($todayCheckin['smoke_clean'] ?? false),
                'alcohol_clean' => (bool) ($todayCheckin['alcohol_clean'] ?? false),
            ],
            'rewards' => $rewards,
            'missions' => $missions,
            'missions_summary' => $this->missionSummary($missions),
            'trigger_map' => $triggerMap,
            'weekly_report' => $this->weeklyReport($habits, $recentCravings, $recentIncidents, $recentCheckins, $triggerMap),
            'unlocked_now' => $unlockedNow,
            'logs' => $this->repository->logs($userId),
        ];
    }

    private function dailyMissions(array $habits, array $todayCheckin, int $completedCravingsToday, int $triggerEventsToday): array
    {
        return [
            [
                'code' => 'daily_checkin',
                'icon' => 'shield',
                'title_key' => 'dashboard.mission_daily_checkin_title',
                'body_key' => 'dashboard.mission_daily_checkin_body',
                'reward_key' => 'dashboard.mission_reward_xp',
                'reward_xp' => 10,
                'completed' => $this->activeCheckinDone($habits, $todayCheckin),
            ],
            [
                'code' => 'craving_win',
                'icon' => 'bolt',
                'title_key' => 'dashboard.mission_craving_title',
                'body_key' => 'dashboard.mission_craving_body',
                'reward_key' => 'dashboard.mission_reward_xp',
                'reward_xp' => 35,
                'completed' => $completedCravingsToday > 0,
            ],
            [
                'code' => 'trigger_scan',
                'icon' => 'star',
                'title_key' => 'dashboard.mission_trigger_title',
                'body_key' => 'dashboard.mission_trigger_body',
                'reward_key' => 'dashboard.mission_reward_intel',
                'reward_xp' => 0,
                'completed' => $triggerEventsToday > 0,
            ],
        ];
    }

    private function missionSummary(array $missions): array
    {
        $completed = count(array_filter($missions, static fn (array $mission): bool => (bool) $mission['completed']));

        return [
            'completed' => $completed,
            'total' => count($missions),
            'percent' => count($missions) > 0 ? (int) round(($completed / count($missions)) * 100) : 0,
        ];
    }

    private function triggerMap(array $cravings, array $incidents): array
    {
        $reasonCounts = [];
        $hourCounts = [];
        $habitCounts = ['smoking' => 0, 'alcohol' => 0];
        $events = 0;

        foreach ($cravings as $craving) {
            $reason = trim((string) ($craving['reason'] ?? ''));
            if ($reason !== '') {
                $reasonCounts[$reason] = ($reasonCounts[$reason] ?? 0) + 1;
                $events++;
            }

            $habitType = (string) ($craving['habit_type'] ?? '');
            if (isset($habitCounts[$habitType])) {
                $habitCounts[$habitType]++;
            }

            $hour = $this->eventHour((string) (($craving['completed_at'] ?? '') ?: ($craving['created_at'] ?? '')));
            if ($hour !== null) {
                $hourCounts[$hour] = ($hourCounts[$hour] ?? 0) + 1;
            }
        }

        foreach ($incidents as $incident) {
            $events++;
            $habitType = (string) ($incident['habit_type'] ?? '');
            if (isset($habitCounts[$habitType])) {
                $habitCounts[$habitType]++;
            }

            $hour = $this->eventHour((string) ($incident['created_at'] ?? ''));
            if ($hour !== null) {
                $hourCounts[$hour] = ($hourCounts[$hour] ?? 0) + 1;
            }
        }

        arsort($reasonCounts);
        arsort($hourCounts);
        $maxReasonCount = max([1, ...array_values($reasonCounts)]);
        $topReasons = [];

        foreach (array_slice($reasonCounts, 0, 4, true) as $reason => $count) {
            $topReasons[] = [
                'label' => $reason,
                'count' => $count,
                'percent' => (int) round(($count / $maxReasonCount) * 100),
            ];
        }

        $dangerHour = array_key_first($hourCounts);

        return [
            'period_days' => 7,
            'events' => $events,
            'craving_events' => count($cravings),
            'incident_events' => count($incidents),
            'top_reasons' => $topReasons,
            'top_trigger' => $topReasons[0]['label'] ?? '',
            'danger_hour' => $this->hourLabel(is_int($dangerHour) ? $dangerHour : null),
            'habit_counts' => $habitCounts,
        ];
    }

    private function weeklyReport(array $habits, array $cravings, array $incidents, array $checkins, array $triggerMap): array
    {
        $wins = count(array_filter($cravings, static fn (array $craving): bool => (int) ($craving['completed'] ?? 0) === 1));
        $incidentCount = count($incidents);
        $cleanCheckins = count(array_filter($checkins, fn (array $checkin): bool => $this->activeCheckinDone($habits, $checkin)));
        $topTrigger = (string) ($triggerMap['top_trigger'] ?? '');
        $focusKey = 'dashboard.weekly_focus_start';

        if ($incidentCount > 0 && $incidentCount >= $wins) {
            $focusKey = 'dashboard.weekly_focus_incidents';
        } elseif ($topTrigger !== '') {
            $focusKey = 'dashboard.weekly_focus_trigger';
        } elseif ($cleanCheckins >= 3) {
            $focusKey = 'dashboard.weekly_focus_consistency';
        }

        return [
            'period_days' => 7,
            'craving_wins' => $wins,
            'incidents' => $incidentCount,
            'clean_checkins' => $cleanCheckins,
            'focus_key' => $focusKey,
            'focus_trigger' => $topTrigger,
        ];
    }

    private function activeCheckinDone(array $habits, array $checkin): bool
    {
        $activeFields = [
            'smoking' => 'smoke_clean',
            'alcohol' => 'alcohol_clean',
        ];
        $hasActiveHabit = false;

        foreach ($activeFields as $habitType => $field) {
            if (!isset($habits[$habitType])) {
                continue;
            }

            $hasActiveHabit = true;
            if ((int) ($checkin[$field] ?? 0) !== 1) {
                return false;
            }
        }

        return $hasActiveHabit;
    }

    private function decorateHabits(array $habits): array
    {
        $out = [];

        foreach ($habits as $type => $habit) {
            $hours = $this->hoursSince($habit['current_streak_start_at'] ?? null);
            $out[$type] = [
                'type' => $type,
                'start_at' => $habit['start_at'],
                'current_streak_start_at' => $habit['current_streak_start_at'],
                'hours' => round($hours, 2),
                'days' => floor($hours / 24),
                'smoking_product' => $habit['smoking_product'] === 'vape' ? 'vape' : 'tobacco',
                'cigarettes_per_day' => $this->floatOrNull($habit['cigarettes_per_day'] ?? null),
                'cigarettes_per_pack' => $this->floatOrNull($habit['cigarettes_per_pack'] ?? null),
                'pack_price' => $this->floatOrNull($habit['pack_price'] ?? null),
                'vape_weekly_spend' => $this->floatOrNull($habit['vape_weekly_spend'] ?? null),
                'alcohol_weekly_spend' => $this->floatOrNull($habit['alcohol_weekly_spend'] ?? null),
                'dangerous_days' => $this->jsonArray($habit['dangerous_days'] ?? null),
            ];
        }

        return $out;
    }

    private function money(array $habits, ?array $goal): array
    {
        $dailySmoking = 0.0;
        $dailyAlcohol = 0.0;
        $smokingTotal = 0.0;
        $alcoholTotal = 0.0;
        $smokingLastWeek = 0.0;
        $alcoholLastWeek = 0.0;

        if (isset($habits['smoking'])) {
            if (($habits['smoking']['smoking_product'] ?? 'tobacco') === 'vape') {
                $dailySmoking = (float) ($habits['smoking']['vape_weekly_spend'] ?? 0) / 7;
            } else {
                $perDay = (float) ($habits['smoking']['cigarettes_per_day'] ?? 0);
                $perPack = max(1.0, (float) ($habits['smoking']['cigarettes_per_pack'] ?? 20));
                $price = (float) ($habits['smoking']['pack_price'] ?? 0);
                $dailySmoking = ($perDay / $perPack) * $price;
            }
            $smokingDays = $this->hoursSince($habits['smoking']['current_streak_start_at'] ?? null) / 24;
            $smokingTotal = $dailySmoking * $smokingDays;
            $smokingLastWeek = $dailySmoking * min(7, $smokingDays);
        }

        if (isset($habits['alcohol'])) {
            $dailyAlcohol = (float) ($habits['alcohol']['alcohol_weekly_spend'] ?? 0) / 7;
            $alcoholDays = $this->hoursSince($habits['alcohol']['current_streak_start_at'] ?? null) / 24;
            $alcoholTotal = $dailyAlcohol * $alcoholDays;
            $alcoholLastWeek = $dailyAlcohol * min(7, $alcoholDays);
        }

        $total = max(0, $smokingTotal + $alcoholTotal);
        $target = max(0, (float) ($goal['target_amount'] ?? 0));
        $currency = (string) ($goal['currency'] ?? 'EUR');
        $progress = $target > 0 ? min(100, round(($total / $target) * 100)) : 0;
        $dailyRate = max(0, $dailySmoking + $dailyAlcohol);
        $treats = array_map(static fn (array $treat): array => $treat + [
            'unlocked' => $total >= $treat['amount'],
            'remaining' => round(max(0, $treat['amount'] - $total), 2),
            'currency' => $currency,
        ], self::REWARD_CATALOG);
        $nextTreat = null;
        foreach ($treats as $treat) {
            if (!$treat['unlocked']) {
                $nextTreat = $treat;
                break;
            }
        }

        $nextTarget = null;
        if (is_array($nextTreat)) {
            $remaining = (float) $nextTreat['remaining'];
            $nextTarget = [
                'type' => 'treat',
                'title_key' => $nextTreat['title_key'],
                'title' => '',
                'amount' => (float) $nextTreat['amount'],
                'remaining' => $remaining,
                'progress_percent' => (int) min(100, round(($total / max(1, (float) $nextTreat['amount'])) * 100)),
                'days_remaining' => $dailyRate > 0 ? (int) ceil($remaining / $dailyRate) : null,
            ];
        } elseif ($target > $total) {
            $remaining = max(0, $target - $total);
            $nextTarget = [
                'type' => 'goal',
                'title_key' => '',
                'title' => (string) ($goal['title'] ?? ''),
                'amount' => $target,
                'remaining' => round($remaining, 2),
                'progress_percent' => $progress,
                'days_remaining' => $dailyRate > 0 ? (int) ceil($remaining / $dailyRate) : null,
            ];
        }

        return [
            'daily_smoking_saving' => round($dailySmoking, 2),
            'daily_alcohol_saving' => round($dailyAlcohol, 2),
            'saved_today' => round($dailySmoking + $dailyAlcohol, 2),
            'daily_rate' => round($dailyRate, 2),
            'saved_week' => round($smokingLastWeek + $alcoholLastWeek, 2),
            'month_projection' => round($dailyRate * 30, 2),
            'saved_total' => round($total, 2),
            'goal' => [
                'title' => $goal['title'] ?? '',
                'target_amount' => round($target, 2),
                'currency' => $currency,
                'progress_percent' => $progress,
                'remaining' => round(max(0, $target - $total), 2),
            ],
            'next_target' => $nextTarget,
            'treats' => $treats,
        ];
    }

    private function progression(int $xp): array
    {
        $xp = max(0, $xp);
        $currentIndex = 0;

        foreach (self::LEVELS as $index => $level) {
            if ($xp >= $level['xp']) {
                $currentIndex = $index;
            }
        }

        $current = self::LEVELS[$currentIndex];
        $next = self::LEVELS[$currentIndex + 1] ?? null;
        $levelStart = (int) $current['xp'];
        $nextXp = is_array($next) ? (int) $next['xp'] : $levelStart;
        $span = max(1, $nextXp - $levelStart);
        $intoLevel = max(0, $xp - $levelStart);

        return [
            'level' => $currentIndex + 1,
            'code' => $current['code'],
            'title_key' => 'progression.levels.' . $current['code'] . '.title',
            'body_key' => 'progression.levels.' . $current['code'] . '.body',
            'xp' => $xp,
            'level_start_xp' => $levelStart,
            'next_level_xp' => $nextXp,
            'xp_into_level' => $intoLevel,
            'xp_for_next' => is_array($next) ? $span : 0,
            'remaining_xp' => is_array($next) ? max(0, $nextXp - $xp) : 0,
            'progress_percent' => is_array($next) ? (int) min(100, round(($intoLevel / $span) * 100)) : 100,
            'max_level' => !is_array($next),
        ];
    }

    private function decorateRewards(array $rewards, array $rewardCodes): array
    {
        return array_map(static fn (array $reward): array => [
            'code' => $reward['code'],
            'title_key' => $reward['title_key'],
            'description_key' => $reward['description_key'],
            'required_hours' => (int) $reward['required_hours'],
            'rarity' => $reward['rarity'],
            'reward_type' => $reward['reward_type'],
            'unlocked' => isset($rewardCodes[$reward['code']]),
        ], $rewards);
    }

    private function controlHours(array $habits): float
    {
        if ($habits === []) {
            return 0.0;
        }

        $hours = array_map(fn (array $habit): float => $this->hoursSince($habit['current_streak_start_at'] ?? null), $habits);
        return min($hours);
    }

    private function reactorPercent(float $controlHours, array $rewards): int
    {
        if ($rewards === []) {
            return 0;
        }

        $previous = 0.0;
        foreach ($rewards as $reward) {
            $required = (float) $reward['required_hours'];
            if ($controlHours < $required) {
                $span = max(1.0, $required - $previous);
                return (int) max(0, min(99, round((($controlHours - $previous) / $span) * 100)));
            }
            $previous = $required;
        }

        return 100;
    }

    private function statusKey(float $controlHours): string
    {
        $days = $controlHours / 24;
        if ($days >= 30) {
            return 'status.maximum';
        }
        if ($days >= 14) {
            return 'status.reactor';
        }
        if ($days >= 7) {
            return 'status.control';
        }
        if ($days >= 3) {
            return 'status.stabilization';
        }
        return 'status.launch';
    }

    private function levelKey(float $controlHours, array $rewards): string
    {
        $current = 'rewards.pending.title';

        foreach ($rewards as $reward) {
            if ($controlHours >= (float) $reward['required_hours']) {
                $current = (string) $reward['title_key'];
            }
        }

        return $current;
    }

    private function nextReward(float $controlHours, array $rewards): ?array
    {
        foreach ($rewards as $reward) {
            if ($controlHours < (float) $reward['required_hours']) {
                return $reward;
            }
        }

        return null;
    }

    private function hoursSince(?string $date): float
    {
        if ($date === null || $date === '') {
            return 0.0;
        }

        $start = new DateTimeImmutable($date);
        return max(0, (time() - $start->getTimestamp()) / 3600);
    }

    private function eventHour(string $date): ?int
    {
        if ($date === '') {
            return null;
        }

        return (int) (new DateTimeImmutable($date))->format('G');
    }

    private function hourLabel(?int $hour): string
    {
        if ($hour === null) {
            return '';
        }

        return sprintf('%02d:00-%02d:00', $hour, ($hour + 1) % 24);
    }

    private function floatOrNull(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function jsonArray(?string $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
}
