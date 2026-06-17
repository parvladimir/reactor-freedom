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
        $stmt = $this->pdo->prepare(
            'SELECT id, name, email, language, email_verified_at, marketing_opt_in, marketing_opt_in_at, created_at, updated_at
             FROM users WHERE id = :id LIMIT 1'
        );
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        return is_array($user) ? $user : null;
    }

    public function create(string $name, string $email, string $passwordHash, string $language, bool $marketingOptIn = false): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (
                name, email, password_hash, language, email_verified_at,
                marketing_opt_in, marketing_opt_in_at, created_at, updated_at
             ) VALUES (
                :name, :email, :password_hash, :language, NULL,
                :marketing_opt_in, :marketing_opt_in_at, NOW(), NOW()
             )'
        );
        $stmt->execute([
            'name' => $name,
            'email' => strtolower($email),
            'password_hash' => $passwordHash,
            'language' => $language,
            'marketing_opt_in' => $marketingOptIn ? 1 : 0,
            'marketing_opt_in_at' => $marketingOptIn ? date('Y-m-d H:i:s') : null,
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

    public function markEmailVerified(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users
             SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute(['id' => $userId]);
    }

    public function deleteById(int $userId): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
    }
}
