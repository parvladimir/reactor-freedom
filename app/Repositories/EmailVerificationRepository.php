<?php
declare(strict_types=1);

namespace Reactor\Repositories;

use PDO;

final class EmailVerificationRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function create(int $userId, string $email, string $token, int $hours = 24): void
    {
        $this->pdo->prepare(
            'UPDATE email_verifications
             SET verified_at = NOW()
             WHERE user_id = :user_id AND verified_at IS NULL'
        )->execute(['user_id' => $userId]);

        $stmt = $this->pdo->prepare(
            'INSERT INTO email_verifications (user_id, email, token_hash, expires_at, verified_at, created_at)
             VALUES (:user_id, :email, :token_hash, DATE_ADD(NOW(), INTERVAL :hours HOUR), NULL, NOW())'
        );
        $stmt->bindValue('user_id', $userId, PDO::PARAM_INT);
        $stmt->bindValue('email', strtolower($email));
        $stmt->bindValue('token_hash', hash('sha256', $token));
        $stmt->bindValue('hours', $hours, PDO::PARAM_INT);
        $stmt->execute();
    }

    public function findActiveByToken(string $token): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT *
             FROM email_verifications
             WHERE token_hash = :token_hash
               AND verified_at IS NULL
               AND expires_at >= NOW()
             LIMIT 1'
        );
        $stmt->execute(['token_hash' => hash('sha256', $token)]);
        $verification = $stmt->fetch();

        return is_array($verification) ? $verification : null;
    }

    public function markVerified(int $verificationId): void
    {
        $stmt = $this->pdo->prepare('UPDATE email_verifications SET verified_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $verificationId]);
    }
}
