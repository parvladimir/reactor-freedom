<?php
declare(strict_types=1);

namespace Reactor\Repositories;

use PDO;

final class UserRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower($email)]);
        $user = $stmt->fetch();

        return is_array($user) ? $user : null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, name, email, language, created_at, updated_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        return is_array($user) ? $user : null;
    }

    public function create(string $name, string $email, string $passwordHash, string $language): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (name, email, password_hash, language, created_at, updated_at)
             VALUES (:name, :email, :password_hash, :language, NOW(), NOW())'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower($email),
            'password_hash' => $passwordHash,
            'language' => $language,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function updateLanguage(int $userId, string $language): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET language = :language, updated_at = NOW() WHERE id = :id');
        $stmt->execute(['language' => $language, 'id' => $userId]);
    }

    public function touchName(int $userId, string $name): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET name = :name, updated_at = NOW() WHERE id = :id');
        $stmt->execute(['name' => $name, 'id' => $userId]);
    }
}
