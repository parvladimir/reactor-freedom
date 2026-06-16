<?php
declare(strict_types=1);

$app = require __DIR__ . '/../app/Helpers/bootstrap.php';

use Reactor\Services\Database;

$pdo = Database::pdo();
$rewards = require REACTOR_ROOT . '/database/seeds/rewards.php';
$stmt = $pdo->prepare(
    'INSERT INTO rewards (code, title_key, description_key, required_hours, rarity, reward_type, created_at)
     VALUES (:code, :title_key, :description_key, :required_hours, :rarity, :reward_type, NOW())
     ON DUPLICATE KEY UPDATE title_key = VALUES(title_key), description_key = VALUES(description_key),
     required_hours = VALUES(required_hours), rarity = VALUES(rarity), reward_type = VALUES(reward_type)'
);

foreach ($rewards as [$code, $titleKey, $descriptionKey, $hours, $rarity, $type]) {
    $stmt->execute([
        'code' => $code,
        'title_key' => $titleKey,
        'description_key' => $descriptionKey,
        'required_hours' => $hours,
        'rarity' => $rarity,
        'reward_type' => $type,
    ]);
    echo "seeded {$code}\n";
}

echo "done\n";
