<?php
declare(strict_types=1);

$app = require __DIR__ . '/../app/Helpers/bootstrap.php';

use Reactor\Controllers\ApiController;
use Reactor\Helpers\Csrf;

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');

if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($requestPath, $scriptDir)) {
    $requestPath = substr($requestPath, strlen($scriptDir)) ?: '/';
}

if (str_starts_with($requestPath, '/api/')) {
    ApiController::dispatch($requestPath, $_SERVER['REQUEST_METHOD'] ?? 'GET');
}

$basePath = $scriptDir === '/' ? '' : $scriptDir;
$csrf = Csrf::token();
$assetVersion = '39';
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#050813">
  <meta name="color-scheme" content="dark">
  <title>REACTOR: Freedom</title>
  <link rel="manifest" href="<?= htmlspecialchars($basePath, ENT_QUOTES) ?>/manifest.webmanifest">
  <link rel="icon" href="<?= htmlspecialchars($basePath, ENT_QUOTES) ?>/assets/icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="<?= htmlspecialchars($basePath, ENT_QUOTES) ?>/assets/css/app.css?v=<?= $assetVersion ?>">
</head>
<body>
  <svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="ringGradient" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#8a5cff"></stop>
        <stop offset="34%" stop-color="#00d7ff"></stop>
        <stop offset="68%" stop-color="#7bffcf"></stop>
        <stop offset="100%" stop-color="#ffd166"></stop>
      </linearGradient>
      <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="5" result="blur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    </defs>
    <symbol id="i-reactor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M19.2 4.8l-2.1 2.1M6.9 17.1l-2.1 2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><path d="M10.3 2.6c.7-1 2.7-1 3.4 0l.8 1.2c.2.3.7.5 1 .4l1.4-.3c1.2-.3 2.6 1.1 2.3 2.3l-.3 1.4c-.1.4.1.8.4 1l1.2.8c1 .7 1 2.7 0 3.4l-1.2.8c-.3.2-.5.7-.4 1l.3 1.4c.3 1.2-1.1 2.6-2.3 2.3l-1.4-.3c-.4-.1-.8.1-1 .4l-.8 1.2c-.7 1-2.7 1-3.4 0l-.8-1.2c-.2-.3-.7-.5-1-.4l-1.4.3c-1.2.3-2.6-1.1-2.3-2.3l.3-1.4c.1-.4-.1-.8-.4-1l-1.2-.8c-1-.7-1-2.7 0-3.4l1.2-.8c.3-.2.5-.7.4-1l-.3-1.4C4.1 5 5.5 3.6 6.7 3.9l1.4.3c.4.1.8-.1 1-.4l.8-1.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
    <symbol id="i-smoke" viewBox="0 0 24 24"><path d="M4 15h11.8a2 2 0 0 1 0 4H4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M18 15v4M20.7 14.4c.5-.7.8-1.3.8-2 0-1-.7-1.6-1.1-2.1-.4-.5-.8-.9-.8-1.5 0-.5.2-.9.6-1.4M16.7 13.4c.5-.7.8-1.3.8-2 0-1-.7-1.6-1.1-2.1-.4-.5-.8-.9-.8-1.5 0-.5.2-.9.6-1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 4 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
    <symbol id="i-vape" viewBox="0 0 24 24"><rect x="4" y="12" width="13" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M17 14h3v3h-3M8 12V8.5c0-1.3 1-2.4 2.3-2.4 1 0 1.7-.7 1.7-1.7V3M5 4 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-alcohol" viewBox="0 0 24 24"><path d="M8 3h8l-1 7a3 3 0 0 1-3 2 3 3 0 0 1-3-2L8 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12v7M9 19h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 4 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
    <symbol id="i-money" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 9.5h.01M17 14.5h.01" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 5.5 5.6v5.4c0 4.2 2.6 7.1 6.5 9 3.9-1.9 6.5-4.8 6.5-9V5.6L12 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9.3 12 1.8 1.8 3.6-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 11v4M9 19h6M10 15h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-flame" viewBox="0 0 24 24"><path d="M12.3 3.5c1.4 2.1 2.7 4.1 2.7 6 0 1.3-.5 2.4-1.2 3.2 1.8-.1 4.2 1.6 4.2 4.5 0 3.2-2.6 5.3-6 5.3s-6-2.1-6-5.3c0-2.4 1.5-3.9 3.1-5 .8-.6 1.7-1.3 2.3-2.4.6-1.1 1-2.4.9-4.3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9L12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><path d="M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.8 20a5.8 5.8 0 0 1 11.4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16.4 11.2a3 3 0 1 0-1.2-5.8M15.7 14.5a5 5 0 0 1 5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.5S4.2 15.7 3.2 9.8C2.6 6.3 4.7 4 7.3 4c1.8 0 3.3 1 4.1 2.4C12.2 5 13.7 4 15.5 4c2.6 0 4.7 2.3 4.1 5.8-1 5.9-7.6 10.7-7.6 10.7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
    <symbol id="i-brain" viewBox="0 0 24 24"><path d="M9.2 4.2A3.2 3.2 0 0 0 4.8 7a3.2 3.2 0 0 0-1.4 5.9A3.5 3.5 0 0 0 8 18.2c.4 1.4 1.6 2.3 3 2.3V4.8a3.2 3.2 0 0 0-1.8-.6Zm5.6 0A3.2 3.2 0 0 1 19.2 7a3.2 3.2 0 0 1 1.4 5.9 3.5 3.5 0 0 1-4.6 5.3c-.4 1.4-1.6 2.3-3 2.3V4.8a3.2 3.2 0 0 1 1.8-.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.1 9.1c1.8 0 2.8 1 3.9 2.2M16.9 9.1c-1.8 0-2.8 1-3.9 2.2M7.8 15.3c1.2-.1 2.3.4 3.2 1.4M16.2 15.3c-1.2-.1-2.3.4-3.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></symbol>
    <symbol id="i-lungs" viewBox="0 0 24 24"><path d="M11 4v8.2c-1.6-2.7-2.5-5.2-4-4.8-2.4.6-3.7 5.4-3.5 9.5.1 2.2 1.8 3.3 3.7 2.4 2.2-1 3.5-3.1 3.8-5.4M13 4v8.2c1.6-2.7 2.5-5.2 4-4.8 2.4.6 3.7 5.4 3.5 9.5-.1 2.2-1.8 3.3-3.7 2.4-2.2-1-3.5-3.1-3.8-5.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M20.5 3.5C12.8 3.7 6 8.2 4.8 14.5c-.5 2.7 1.4 5.1 4.1 5.1 6.2 0 10.5-7.2 11.6-16.1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4 20c3.3-5.2 7.4-8.4 12.4-10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20.2 15.4A8.6 8.6 0 0 1 8.6 3.8 8.6 8.6 0 1 0 20.2 15.4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
    <symbol id="i-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.3 10h.01M15.7 10h.01M8.5 14.2c1 1.4 2.1 2.1 3.5 2.1s2.5-.7 3.5-2.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
    <symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-camera" viewBox="0 0 24 24"><path d="M4.5 7.5h3L9 5h6l1.5 2.5h3A2.5 2.5 0 0 1 22 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5V10a2.5 2.5 0 0 1 2.5-2.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M5 17h14l-1.7-2.4V10a5.3 5.3 0 0 0-10.6 0v4.6L5 17Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-message" viewBox="0 0 24 24"><path d="M5 5.2h14a2.2 2.2 0 0 1 2.2 2.2v7.4A2.2 2.2 0 0 1 19 17H9.2L4 21v-3.8A2.2 2.2 0 0 1 2.8 15V7.4A2.2 2.2 0 0 1 5 5.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7.2 9.5h9.6M7.2 13h6.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m15.4 15.4 5.1 5.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
    <symbol id="i-log-out" viewBox="0 0 24 24"><path d="M14 8V5.5A2.5 2.5 0 0 0 11.5 3h-5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h5a2.5 2.5 0 0 0 2.5-2.5V16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10 12h10m-3.5-3.5L20 12l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
    <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M3 3 21 21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10.7 5.2A10.8 10.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16.3 16.3 0 0 1-3 3.8M6.1 6.9C3.8 8.4 2.5 12 2.5 12S6 19 12 19c1.6 0 3-.4 4.2-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
  </svg>

  <div id="app" class="app-shell" aria-live="polite"></div>
  <div id="modal-root"></div>

  <script>
    window.REACTOR_BOOT = {
      csrf: <?= json_encode($csrf, JSON_UNESCAPED_SLASHES) ?>,
      basePath: <?= json_encode($basePath, JSON_UNESCAPED_SLASHES) ?>,
      assetVersion: <?= json_encode($assetVersion) ?>,
      defaultLanguage: "en"
    };
  </script>
  <script src="<?= htmlspecialchars($basePath, ENT_QUOTES) ?>/assets/js/app.js?v=<?= $assetVersion ?>" defer></script>
</body>
</html>
