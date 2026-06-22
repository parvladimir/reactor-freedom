<?php
declare(strict_types=1);

namespace Reactor\Controllers;

use InvalidArgumentException;
use Reactor\Helpers\Csrf;
use Reactor\Helpers\I18n;
use Reactor\Helpers\Input;
use Reactor\Helpers\Response;
use Reactor\Middleware\AuthMiddleware;
use Reactor\Repositories\AppRepository;
use Reactor\Repositories\EmailVerificationRepository;
use Reactor\Repositories\SocialRepository;
use Reactor\Repositories\UserRepository;
use Reactor\Services\AvatarService;
use Reactor\Services\DashboardService;
use Reactor\Services\Database;
use Reactor\Services\EmailService;
use Throwable;

final class ApiController
{
    private UserRepository $users;
    private EmailVerificationRepository $emailVerifications;
    private AppRepository $app;
    private SocialRepository $social;
    private DashboardService $dashboard;
    private EmailService $emailService;
    private AvatarService $avatarService;
    private array $config;

    public function __construct()
    {
        $pdo = Database::pdo();
        $this->config = require REACTOR_ROOT . '/config/app.php';
        $this->users = new UserRepository($pdo);
        $this->emailVerifications = new EmailVerificationRepository($pdo);
        $this->app = new AppRepository($pdo);
        $this->social = new SocialRepository($pdo);
        $this->dashboard = new DashboardService($this->app);
        $this->emailService = new EmailService($this->config);
        $this->avatarService = new AvatarService();
    }

    public static function dispatch(string $path, string $method): never
    {
        try {
            if ($method === 'GET' && rtrim($path, '/') === '/api/i18n') {
                $language = I18n::normalize((string) ($_GET['lang'] ?? 'en'));
                Response::ok(['language' => $language, 'messages' => I18n::load($language)]);
            }

            if ($method !== 'GET') {
                Csrf::verify();
            }

            (new self())->route($path, $method);
        } catch (Throwable $throwable) {
            $debug = (string) ($_ENV['APP_ENV'] ?? '') === 'local';
            Response::error(
                $debug ? $throwable->getMessage() : 'Server error.',
                500,
                'server_error'
            );
        }
    }

    private function route(string $path, string $method): never
    {
        $route = $method . ' ' . rtrim($path, '/');

        match ($route) {
            'GET /api/i18n' => $this->i18n(),
            'GET /api/me' => $this->me(),
            'POST /api/register' => $this->register(),
            'POST /api/login' => $this->login(),
            'POST /api/logout' => $this->logout(),
            'GET /api/email/verify' => $this->verifyEmail(),
            'POST /api/email/resend' => $this->resendVerificationEmail(),
            'GET /api/dashboard' => $this->dashboard(),
            'POST /api/onboarding' => $this->onboarding(),
            'GET /api/settings' => $this->dashboard(),
            'POST /api/settings' => $this->settings(),
            'GET /api/profile/avatar' => $this->profileAvatarImage(),
            'POST /api/profile/avatar' => $this->profileAvatarUpload(),
            'POST /api/profile/avatar/delete' => $this->profileAvatarDelete(),
            'POST /api/checkin' => $this->checkin(),
            'POST /api/craving/start' => $this->cravingStart(),
            'POST /api/craving/complete' => $this->cravingComplete(),
            'POST /api/incident' => $this->incident(),
            'GET /api/social' => $this->social(),
            'GET /api/social/search' => $this->socialSearch(),
            'POST /api/social/follow' => $this->socialFollow(),
            'POST /api/social/unfollow' => $this->socialUnfollow(),
            'POST /api/social/like' => $this->socialLike(),
            'POST /api/social/support' => $this->socialSupport(),
            'POST /api/social/invite' => $this->socialInvite(),
            'GET /api/social/notifications/poll' => $this->socialNotificationsPoll(),
            'POST /api/social/notifications/read' => $this->socialNotificationsRead(),
            'GET /api/rewards' => $this->rewards(),
            'GET /api/logs' => $this->logs(),
            default => Response::error('Endpoint not found.', 404, 'not_found'),
        };
    }

    private function i18n(): never
    {
        $language = I18n::normalize((string) ($_GET['lang'] ?? 'en'));
        Response::ok(['language' => $language, 'messages' => I18n::load($language)]);
    }

    private function me(): never
    {
        $userId = $_SESSION['user_id'] ?? null;
        if ($userId === null) {
            Response::ok(['authenticated' => false]);
        }

        $user = $this->users->findById((int) $userId);
        if ($user === null) {
            unset($_SESSION['user_id']);
            Response::ok(['authenticated' => false]);
        }

        $profile = $this->app->getProfile((int) $user['id']);
        Response::ok([
            'authenticated' => true,
            'user' => $user,
            'onboarding_completed' => (bool) ($profile['onboarding_completed'] ?? false),
        ]);
    }

    private function register(): never
    {
        $data = Input::json();
        $name = Input::string($data, 'name');
        $email = strtolower(Input::string($data, 'email'));
        $password = Input::string($data, 'password');
        $passwordConfirmation = Input::string($data, 'password_confirmation');
        $language = I18n::normalize(Input::string($data, 'language', 'en'));
        $marketingOptIn = Input::bool($data, 'marketing_opt_in');

        if (strlen($name) < 2 || strlen($name) > 80) {
            Response::error('Name must be between 2 and 80 characters.', 422, 'invalid_name');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address.', 422, 'invalid_email');
        }
        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters.', 422, 'weak_password');
        }
        if ($password !== $passwordConfirmation) {
            Response::error('Password confirmation does not match.', 422, 'password_mismatch');
        }
        if ($this->users->findByEmail($email) !== null) {
            Response::error('This email is already registered.', 409, 'email_exists');
        }

        $userId = $this->users->create($name, $email, password_hash($password, PASSWORD_DEFAULT), $language, $marketingOptIn);
        $this->app->ensureUserRecords($userId, $language);
        $user = $this->users->findById($userId);
        $emailSent = is_array($user) && $this->sendVerificationEmail($user, $language);
        if (!$emailSent) {
            $this->users->deleteById($userId);
            Response::error(
                'Verification email could not be sent. Please check SMTP settings.',
                502,
                'email_send_failed'
            );
        }

        Response::ok([
            'authenticated' => false,
            'verification_required' => true,
            'email' => $email,
            'email_sent' => true,
        ], 201);
    }

    private function login(): never
    {
        $data = Input::json();
        $email = strtolower(Input::string($data, 'email'));
        $password = Input::string($data, 'password');
        $language = I18n::normalize(Input::string($data, 'language', 'en'));
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address.', 422, 'invalid_email');
        }
        if ($this->app->countRecentLoginAttempts($email, $ip) >= 5) {
            Response::error('Too many login attempts. Try again later.', 429, 'rate_limited');
        }

        $user = $this->users->findByEmail($email);
        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            $this->app->recordLoginAttempt($email, $ip);
            Response::error('Wrong email or password.', 401, 'bad_credentials');
        }
        if (empty($user['email_verified_at'])) {
            Response::error('Email address is not verified.', 403, 'email_not_verified', ['email' => $email]);
        }

        $this->app->clearLoginAttempts($email, $ip);
        $this->users->updateLanguage((int) $user['id'], $language);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];

        Response::ok(['authenticated' => true, 'user' => $this->users->findById((int) $user['id'])]);
    }

    private function verifyEmail(): never
    {
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '' || strlen($token) < 40) {
            Response::error('Verification link is invalid or expired.', 422, 'email_verification_invalid');
        }

        $verification = $this->emailVerifications->findActiveByToken($token);
        if ($verification === null) {
            Response::error('Verification link is invalid or expired.', 410, 'email_verification_invalid');
        }

        $userId = (int) $verification['user_id'];
        $this->users->markEmailVerified($userId);
        $this->emailVerifications->markVerified((int) $verification['id']);
        $this->app->ensureUserRecords($userId);
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;

        Response::ok([
            'authenticated' => true,
            'user' => $this->users->findById($userId),
        ]);
    }

    private function resendVerificationEmail(): never
    {
        $data = Input::json();
        $email = strtolower(Input::string($data, 'email'));
        $language = I18n::normalize(Input::string($data, 'language', 'en'));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address.', 422, 'invalid_email');
        }

        $user = $this->users->findByEmail($email);
        if ($user === null || !empty($user['email_verified_at'])) {
            Response::ok(['sent' => true]);
        }

        if (!$this->sendVerificationEmail($user, $language)) {
            Response::error(
                'Verification email could not be sent. Please check SMTP settings.',
                502,
                'email_send_failed'
            );
        }

        Response::ok(['sent' => true]);
    }

    private function logout(): never
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }

        session_destroy();
        session_write_close();
        session_id('');
        session_start();
        session_regenerate_id(true);
        Csrf::token();

        Response::ok(['authenticated' => false]);
    }

    private function dashboard(): never
    {
        $user = $this->requireUser();
        Response::ok($this->dashboard->build($user));
    }

    private function onboarding(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $habits = Input::array($data, 'habits');

        if ($habits === [] || array_diff($habits, ['smoking', 'alcohol']) !== []) {
            Response::error('Choose at least one habit.', 422, 'invalid_habits');
        }
        $motivationReasons = $this->motivationReasons($data);
        if ($motivationReasons === []) {
            Response::error('Choose at least one reason.', 422, 'invalid_reasons');
        }

        $payload = [
            'habits' => $habits,
            'main_reason' => $motivationReasons[0],
            'motivation_reasons' => $motivationReasons,
            'custom_reason' => Input::string($data, 'custom_reason') ?: null,
            'goal_title' => Input::string($data, 'goal_title'),
            'goal_amount' => max(1, Input::number($data, 'goal_amount', 1)),
            'currency' => strtoupper(substr(Input::string($data, 'currency', 'EUR'), 0, 3)),
            'cigarettes_per_day' => max(0, Input::number($data, 'cigarettes_per_day')),
            'cigarettes_per_pack' => max(1, Input::number($data, 'cigarettes_per_pack', 20)),
            'pack_price' => max(0, Input::number($data, 'pack_price')),
            'alcohol_weekly_spend' => max(0, Input::number($data, 'alcohol_weekly_spend')),
            'dangerous_days' => Input::array($data, 'dangerous_days'),
        ];

        $this->app->saveOnboarding($userId, $payload);
        Response::ok(['dashboard' => $this->dashboard->build($this->users->findById($userId) ?? ['id' => $userId])]);
    }

    private function settings(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $language = I18n::normalize(Input::string($data, 'language', 'en'));
        $name = Input::string($data, 'name');
        $avatarCode = Input::string($data, 'avatar_code', 'pulse');
        $motivationReasons = $this->motivationReasons($data);
        if ($motivationReasons === []) {
            Response::error('Choose at least one reason.', 422, 'invalid_reasons');
        }

        if ($name !== '' && strlen($name) <= 80) {
            $this->users->touchName($userId, $name);
        }
        $this->users->updateLanguage($userId, $language);
        if (in_array($avatarCode, ['pulse', 'nova', 'focus', 'mint', 'ember', 'orbit'], true)) {
            $this->users->updateAvatar($userId, $avatarCode);
        }

        $this->app->updateSettings($userId, [
            'currency' => strtoupper(substr(Input::string($data, 'currency', 'EUR'), 0, 3)),
            'main_reason' => $motivationReasons[0] ?? '',
            'motivation_reasons' => $motivationReasons,
            'custom_reason' => Input::string($data, 'custom_reason') ?: null,
            'goal_title' => Input::string($data, 'goal_title'),
            'goal_amount' => max(1, Input::number($data, 'goal_amount', 1)),
            'smoking' => $data['smoking'] ?? null,
            'alcohol' => $data['alcohol'] ?? null,
            'reset_progress' => Input::bool($data, 'reset_progress'),
            'confirm_reset' => Input::string($data, 'confirm_reset'),
        ]);

        Response::ok(['dashboard' => $this->dashboard->build($this->users->findById($userId) ?? ['id' => $userId])]);
    }

    private function motivationReasons(array $data): array
    {
        $allowed = ['health', 'money', 'family', 'control', 'energy', 'custom'];
        $reasons = Input::array($data, 'motivation_reasons');
        if ($reasons === []) {
            $legacy = Input::string($data, 'main_reason');
            $reasons = $legacy !== '' ? [$legacy] : [];
        }

        return array_slice(array_values(array_unique(array_filter(
            $reasons,
            static fn ($reason): bool => is_string($reason) && in_array($reason, $allowed, true)
        ))), 0, 6);
    }

    private function profileAvatarImage(): never
    {
        AuthMiddleware::userId();
        $targetId = isset($_GET['user_id']) && is_numeric($_GET['user_id']) ? (int) $_GET['user_id'] : 0;
        if ($targetId < 1) {
            Response::error('Avatar not found.', 404, 'avatar_not_found');
        }

        $avatar = $this->users->avatarStorageById($targetId);
        $filename = is_array($avatar) ? (string) ($avatar['avatar_file'] ?? '') : '';
        $mime = is_array($avatar) ? (string) ($avatar['avatar_mime'] ?? '') : '';
        $path = $this->avatarService->path($filename);
        if ($path === null || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            Response::error('Avatar not found.', 404, 'avatar_not_found');
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . (string) filesize($path));
        header('Cache-Control: private, no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }

    private function profileAvatarUpload(): never
    {
        $userId = AuthMiddleware::userId();
        $file = $_FILES['avatar'] ?? null;
        if (!is_array($file)) {
            Response::error('Choose an avatar image.', 422, 'avatar_invalid');
        }

        $uploadError = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
            || (int) ($file['size'] ?? 0) > AvatarService::MAX_BYTES) {
            Response::error('Avatar image is too large.', 422, 'avatar_too_large');
        }
        if ($uploadError !== UPLOAD_ERR_OK) {
            Response::error('Avatar upload failed.', 422, 'avatar_invalid');
        }

        try {
            $stored = $this->avatarService->store($file, $userId);
        } catch (InvalidArgumentException) {
            Response::error('Use a valid JPG, PNG or WebP image.', 422, 'avatar_invalid');
        }

        $previous = $this->users->avatarStorageById($userId);
        try {
            $this->users->updateAvatarImage($userId, (string) $stored['file'], (string) $stored['mime']);
        } catch (Throwable $throwable) {
            $this->avatarService->delete((string) $stored['file']);
            throw $throwable;
        }
        $this->avatarService->delete(is_array($previous) ? (string) ($previous['avatar_file'] ?? '') : null);

        $user = $this->users->findById($userId);
        Response::ok(['dashboard' => $this->dashboard->build($user ?? ['id' => $userId])]);
    }

    private function profileAvatarDelete(): never
    {
        $userId = AuthMiddleware::userId();
        $previous = $this->users->avatarStorageById($userId);
        $this->users->clearAvatarImage($userId);
        $this->avatarService->delete(is_array($previous) ? (string) ($previous['avatar_file'] ?? '') : null);

        $user = $this->users->findById($userId);
        Response::ok(['dashboard' => $this->dashboard->build($user ?? ['id' => $userId])]);
    }

    private function checkin(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $this->app->saveCheckin(
            $userId,
            Input::bool($data, 'smoke_clean'),
            Input::bool($data, 'alcohol_clean')
        );

        Response::ok(['dashboard' => $this->dashboard->build($this->users->findById($userId) ?? ['id' => $userId])]);
    }

    private function cravingStart(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $habitType = $this->habitTypeOrNull(Input::string($data, 'habit_type'));
        Response::ok(['craving_id' => $this->app->startCraving($userId, $habitType)]);
    }

    private function cravingComplete(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $cravingId = isset($data['craving_id']) && is_numeric($data['craving_id']) ? (int) $data['craving_id'] : null;
        $this->app->completeCraving(
            $userId,
            $cravingId,
            $this->habitTypeOrNull(Input::string($data, 'habit_type')),
            Input::string($data, 'reason'),
            Input::string($data, 'rescue_action')
        );

        Response::ok(['dashboard' => $this->dashboard->build($this->users->findById($userId) ?? ['id' => $userId])]);
    }

    private function incident(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $habitType = Input::string($data, 'habit_type');
        if (!in_array($habitType, ['smoking', 'alcohol'], true)) {
            Response::error('Invalid habit type.', 422, 'invalid_habit_type');
        }

        $this->app->saveIncident($userId, $habitType, Input::string($data, 'note'));
        Response::ok(['dashboard' => $this->dashboard->build($this->users->findById($userId) ?? ['id' => $userId])]);
    }

    private function social(): never
    {
        $userId = AuthMiddleware::userId();
        Response::ok($this->social->summary($userId));
    }

    private function socialSearch(): never
    {
        $userId = AuthMiddleware::userId();
        $query = trim((string) ($_GET['q'] ?? ''));
        Response::ok(['results' => $this->social->searchUsers($userId, $query)]);
    }

    private function socialFollow(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $targetId = isset($data['user_id']) && is_numeric($data['user_id']) ? (int) $data['user_id'] : 0;
        $this->social->follow($userId, $targetId);

        Response::ok($this->social->summary($userId));
    }

    private function socialUnfollow(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $targetId = isset($data['user_id']) && is_numeric($data['user_id']) ? (int) $data['user_id'] : 0;
        $this->social->unfollow($userId, $targetId);

        Response::ok($this->social->summary($userId));
    }

    private function socialLike(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $logId = isset($data['log_id']) && is_numeric($data['log_id']) ? (int) $data['log_id'] : 0;
        $this->social->like($userId, $logId);

        Response::ok($this->social->summary($userId));
    }

    private function socialSupport(): never
    {
        $userId = AuthMiddleware::userId();
        $data = Input::json();
        $logId = isset($data['log_id']) && is_numeric($data['log_id']) ? (int) $data['log_id'] : 0;
        $message = Input::string($data, 'message');
        $this->social->support($userId, $logId, $message);

        Response::ok($this->social->summary($userId));
    }

    private function socialInvite(): never
    {
        $user = $this->requireUser();
        $data = Input::json();
        $email = strtolower(Input::string($data, 'email'));
        $name = Input::string($data, 'name');
        $message = Input::string($data, 'message');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address.', 422, 'invalid_email');
        }
        if (strtolower((string) ($user['email'] ?? '')) === $email) {
            Response::error('Invite another email address.', 422, 'invalid_invite_email');
        }
        if (strlen($message) > 600) {
            $message = function_exists('mb_substr') ? mb_substr($message, 0, 300) : substr($message, 0, 600);
        }

        $language = I18n::normalize((string) ($user['language'] ?? 'en'));
        $sent = $this->emailService->sendInviteEmail(
            $user,
            ['email' => $email, 'name' => $name],
            $this->inviteUrl($language),
            $language,
            $message
        );

        if (!$sent) {
            Response::error('Invite email could not be sent.', 502, 'invite_email_failed');
        }

        Response::ok($this->social->summary((int) $user['id']) + ['invite_sent' => true]);
    }

    private function socialNotificationsRead(): never
    {
        $userId = AuthMiddleware::userId();
        $this->social->markNotificationsRead($userId);

        Response::ok($this->social->summary($userId));
    }

    private function socialNotificationsPoll(): never
    {
        $userId = AuthMiddleware::userId();
        Response::ok([
            'notifications' => $this->social->notifications($userId, 12),
            'unread_count' => $this->social->unreadCount($userId),
        ]);
    }

    private function rewards(): never
    {
        $user = $this->requireUser();
        Response::ok(['rewards' => $this->dashboard->build($user)['rewards']]);
    }

    private function logs(): never
    {
        $userId = AuthMiddleware::userId();
        Response::ok(['logs' => $this->app->logs($userId)]);
    }

    private function requireUser(): array
    {
        $userId = AuthMiddleware::userId();
        $user = $this->users->findById($userId);
        if ($user === null) {
            unset($_SESSION['user_id']);
            Response::error('Authentication required.', 401, 'unauthenticated');
        }

        return $user;
    }

    private function habitTypeOrNull(string $habitType): ?string
    {
        return in_array($habitType, ['smoking', 'alcohol'], true) ? $habitType : null;
    }

    private function sendVerificationEmail(array $user, string $language): bool
    {
        $token = bin2hex(random_bytes(32));
        $this->emailVerifications->create((int) $user['id'], (string) $user['email'], $token);

        return $this->emailService->sendVerificationEmail($user, $this->verificationUrl($token), $language);
    }

    private function verificationUrl(string $token): string
    {
        return rtrim($this->appBaseUrl(), '/') . '/?verify_email=' . rawurlencode($token);
    }

    private function inviteUrl(string $language): string
    {
        return rtrim($this->appBaseUrl(), '/') . '/?invite=1&lang=' . rawurlencode($language);
    }

    private function appBaseUrl(): string
    {
        $baseUrl = (string) ($this->config['url'] ?? '');
        if ($baseUrl === '') {
            $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
            $scheme = $secure ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
            $baseUrl = $scheme . '://' . $host . ($scriptDir !== '' && $scriptDir !== '/' ? $scriptDir : '');
        }

        return $baseUrl;
    }
}
