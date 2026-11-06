$ErrorActionPreference = 'Stop'

$Project = (Get-Location).Path
$PackageFile = Join-Path $Project 'package.json'
$ServerFile = Join-Path $Project 'server.js'

if (!(Test-Path $PackageFile) -or !(Test-Path $ServerFile)) {
    throw 'Run this script from the SHOTO POINT PRO project root, where package.json and server.js are located.'
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupFile = Join-Path $Project "package.json.before-local-dev-fix-$Stamp"
Copy-Item $PackageFile $BackupFile

$Package = Get-Content $PackageFile -Raw | ConvertFrom-Json
if ($null -eq $Package.scripts) {
    throw 'package.json does not contain a scripts section.'
}

# Vercel CLI must not be configured as the project's own dev command.
$Package.scripts.PSObject.Properties.Remove('dev')

# Align the project with the Node 26 runtime installed on this computer.
if ($null -eq $Package.engines) {
    $Package | Add-Member -MemberType NoteProperty -Name engines -Value ([pscustomobject]@{})
}
$Package.engines.node = '26.x'

$Json = $Package | ConvertTo-Json -Depth 50
Set-Content -Path $PackageFile -Value $Json -Encoding UTF8

Write-Host ''
Write-Host 'SPP local development settings updated.' -ForegroundColor Green
Write-Host "Backup: $BackupFile"
Write-Host 'Removed the recursive scripts.dev = vercel dev entry.'
Write-Host 'Set engines.node to 26.x.'
Write-Host ''
Write-Host 'Next run:' -ForegroundColor Cyan
Write-Host '  npm install'
Write-Host '  npm install -g vercel@latest'
Write-Host '  vercel --version'
Write-Host '  npx vercel@latest dev'
