# Shoto Point Production - configure Admin API calls for the same-origin Express API.
# Run the public pages from Node/Express (not a separate static preview server) unless a separate API origin is configured.
$ErrorActionPreference = 'Stop'
$Project = Join-Path $env:USERPROFILE 'Music\Shoto_Point_Production_HTML_JS_Node'
if (!(Test-Path (Join-Path $Project 'package.json')) -or !(Test-Path (Join-Path $Project 'server.js'))) {
    throw "SPP project not found at $Project. Run this from the Music-folder project only."
}
foreach ($file in @('config2.js','app2.js','Adminlogin.html','spp-cms-live.js')) {
    if (!(Test-Path (Join-Path $Project $file))) { throw "Required file is missing: $file. No files have been changed." }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = Join-Path $Project "_spp-api-base-backup-$stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
foreach ($file in @('config2.js','app2.js','Adminlogin.html')) {
    Copy-Item -LiteralPath (Join-Path $Project $file) -Destination (Join-Path $Backup $file) -Force
}

# A blank API_BASE_URL makes the browser call /api/... on the same origin.
# With the local Node server, open the site at http://127.0.0.1:5000/.
$configPath = Join-Path $Project 'config2.js'
$config = Get-Content -LiteralPath $configPath -Raw
$config2 = [regex]::Replace($config, 'API_BASE_URL\s*:\s*([''\"])[^''\"]*\1', 'API_BASE_URL: ''')
if ($config2 -eq $config -and $config -notmatch "API_BASE_URL\s*:\s*''") {
    throw 'Could not safely update API_BASE_URL in config2.js. Backups were created; no application files were changed.'
}
Set-Content -LiteralPath $configPath -Value $config2 -Encoding UTF8

# Make the older Executive Overview summary and its health check use API_BASE_URL too.
$appPath = Join-Path $Project 'app2.js'
$app = Get-Content -LiteralPath $appPath -Raw
$oldDashboard = "const response=await fetch('/api/admin/dashboard'"
$newDashboard = "const apiBase=String(window.SPP_CONFIG?.API_BASE_URL||'').replace(/\/$/,'');`r`n  const response=await fetch(apiBase+'/api/admin/dashboard'"
if ($app.Contains($oldDashboard)) {
    $app = $app.Replace($oldDashboard, $newDashboard)
} elseif ($app -notmatch "fetch\(apiBase\+'/api/admin/dashboard'") {
    throw 'Could not find the expected dashboard request in app2.js. No app2.js changes were saved.'
}
# No cookie session is used; the Admin sends its bearer token from localStorage.
$app = $app.Replace("credentials:'include'", "credentials:'omit'")
Set-Content -LiteralPath $appPath -Value $app -Encoding UTF8

# Adminlogin.html already uses the same-origin /api path; verify it rather than rewriting it.
$loginPath = Join-Path $Project 'Adminlogin.html'
$login = Get-Content -LiteralPath $loginPath -Raw
if ($login -notmatch 'const\s+API\s*=\s*["'']/api["''];') {
    throw 'Adminlogin.html must use const API="/api" for same-origin routing. The original login page remains backed up.'
}

# Syntax validation before asking the user to refresh the browser.
& node --check $appPath
if ($LASTEXITCODE -ne 0) { throw 'app2.js failed Node syntax validation. Restore app2.js from the backup folder.' }
$tmp = Join-Path $Project 'spp-login-script-validation.tmp.js'
$match = [regex]::Match($login, '(?s)<script(?![^>]*src=)[^>]*>(.*?)</script>')
if ($match.Success) {
    Set-Content -LiteralPath $tmp -Value $match.Groups[1].Value -Encoding UTF8
    & node --check $tmp
    $checkExit = $LASTEXITCODE
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    if ($checkExit -ne 0) { throw 'Adminlogin inline script failed syntax validation. Check the backup before retrying.' }
}

Write-Host ''
Write-Host 'SPP ADMIN API TARGET UPDATED.' -ForegroundColor Green
Write-Host 'API base: same-origin (blank API_BASE_URL)' -ForegroundColor Cyan
Write-Host 'Run the website through Node/Express so its same-origin /api routes are available.'
Write-Host "Backup folder: $Backup"
Write-Host 'Do not change .env, JWT_SECRET, MySQL passwords or the database for this fix.'
