$ErrorActionPreference = 'Stop'
$Project = Join-Path $env:USERPROFILE 'Documents\SHOTO POINT PRO'

if (!(Test-Path (Join-Path $Project 'server.js'))) {
    throw "Cannot find server.js in $Project. Stop; no changes were made."
}
if (!(Test-Path (Join-Path $Project 'package.json'))) {
    throw "Cannot find package.json in $Project. Stop; no changes were made."
}
if (!(Test-Path (Join-Path $Project 'newsroom.js'))) {
    throw "Cannot find newsroom.js in $Project. Stop; no changes were made."
}

Set-Location $Project
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = Join-Path $Project ".spp-cms-backups\express-routing-$Stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null

# Back up configuration before changing the Vercel routing model.
Copy-Item '.\server.js' (Join-Path $Backup 'server.js') -Force
Copy-Item '.\package.json' (Join-Path $Backup 'package.json') -Force
if (Test-Path '.\vercel.json') {
    Copy-Item '.\vercel.json' (Join-Path $Backup 'vercel.json') -Force
}

# Vercel's Express integration detects the root server.js export and sends
# all application paths through Express. Move the older /api function wrappers
# out of the reserved api directory so they do not compete with that entrypoint.
if (Test-Path '.\api') {
    Move-Item '.\api' (Join-Path $Backup 'api-functions') -Force
}

# Mount the existing RSS newsroom handler into the main Express application.
$ServerPath = Join-Path $Project 'server.js'
$ServerText = [System.IO.File]::ReadAllText($ServerPath)
if (!$ServerText.Contains('/api/public/newsroom')) {
    $Marker = 'app.get("/api/health"'
    if (!$ServerText.Contains($Marker)) {
        throw 'Could not locate the API health route in server.js. Restore the backup before proceeding.'
    }
    $Insertion = "app.get('/api/public/newsroom', require('./newsroom'));`r`n`r`n" + $Marker
    $ServerText = $ServerText.Replace($Marker, $Insertion)
    [System.IO.File]::WriteAllText($ServerPath, $ServerText, [System.Text.UTF8Encoding]::new($false))
}

# Keep static HTML, scripts, styles, images, fonts and media under public/.
# Vercel serves public assets through its CDN while the root Express app handles APIs.
$PublicRoot = Join-Path $Project 'public'
New-Item -ItemType Directory -Path $PublicRoot -Force | Out-Null
$ExcludedDirs = @('node_modules', '.git', '.vercel', '.spp-cms-backups', 'database', 'scripts', 'api', 'uploads', 'public', 'spp_downloads', 'dist', 'build')
$ExcludedFiles = @('server.js', 'newsroom.js', 'package.json', 'package-lock.json', 'vercel.json', '.env', '.env.example')
$AllowedExtensions = @('.html', '.htm', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg', '.pdf', '.woff', '.woff2', '.ttf', '.otf')
$Copied = 0
Get-ChildItem -Path $Project -Recurse -File -Force | ForEach-Object {
    $Relative = $_.FullName.Substring($Project.Length).TrimStart('\', '/')
    $Parts = $Relative -split '[\\/]'
    if ($Parts.Count -gt 0 -and ($ExcludedDirs -contains $Parts[0])) { return }
    if ($ExcludedFiles -contains $_.Name) { return }
    if ($AllowedExtensions -notcontains $_.Extension.ToLowerInvariant()) { return }
    if ($Parts[0].StartsWith('.')) { return }
    $Destination = Join-Path $PublicRoot $Relative
    $DestinationDir = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
    Copy-Item $_.FullName $Destination -Force
    $Copied++
}

# Remove the old Functions glob configuration; retain cache-control headers.
if (Test-Path '.\vercel.json') {
    $VercelConfig = Get-Content '.\vercel.json' -Raw | ConvertFrom-Json
    if ($VercelConfig.PSObject.Properties.Name -contains 'functions') {
        $VercelConfig.PSObject.Properties.Remove('functions')
    }
    $Json = $VercelConfig | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText((Join-Path $Project 'vercel.json'), $Json, [System.Text.UTF8Encoding]::new($false))
}

# Remove the old recursive npm dev script if it is still present.
$Package = Get-Content '.\package.json' -Raw | ConvertFrom-Json
if ($Package.scripts -and $Package.scripts.dev -eq 'vercel dev') {
    $Package.scripts.PSObject.Properties.Remove('dev')
}
if ($Package.engines) { $Package.engines.node = '26.x' }
$PackageJson = $Package | ConvertTo-Json -Depth 40
[System.IO.File]::WriteAllText((Join-Path $Project 'package.json'), $PackageJson, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'SPP Express routing repair completed.' -ForegroundColor Green
Write-Host "Static website files copied to public/: $Copied"
Write-Host "Backup saved at: $Backup"
Write-Host 'The root server.js will now handle all /api/* routes, including nested admin endpoints.' -ForegroundColor Cyan
Write-Host 'SYFM source files were copied only; original SYFM files were not edited.' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next: run npm install, then npx vercel@latest dev.'
