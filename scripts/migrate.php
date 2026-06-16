<?php
declare(strict_types=1);

$app = require __DIR__ . '/../app/Helpers/bootstrap.php';

use Reactor\Services\Database;

$pdo = Database::pdo();
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        migration VARCHAR(190) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

$applied = $pdo->query('SELECT migration FROM migrations')->fetchAll(PDO::FETCH_COLUMN);
$applied = array_flip($applied ?: []);
$files = glob(REACTOR_ROOT . '/database/migrations/*.php') ?: [];
sort($files);

foreach ($files as $file) {
    $name = basename($file);
    if (isset($applied[$name])) {
        echo "skip {$name}\n";
        continue;
    }

    $statements = require $file;
    if (!is_array($statements)) {
        throw new RuntimeException("Migration {$name} must return an array of SQL statements.");
    }

    foreach ($statements as $sql) {
        $pdo->exec($sql);
    }

    $stmt = $pdo->prepare('INSERT INTO migrations (migration, applied_at) VALUES (:migration, NOW())');
    $stmt->execute(['migration' => $name]);
    echo "applied {$name}\n";
}

echo "done\n";
