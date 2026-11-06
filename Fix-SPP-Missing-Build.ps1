$ErrorActionPreference = 'Stop'
$Project = Join-Path $env:USERPROFILE 'Documents\SHOTO POINT PRO'
Set-Location $Project

$PackageFile = Join-Path $Project 'package.json'
if (!(Test-Path $PackageFile)) { throw "package.json not found in $Project" }

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = Join-Path $Project "package.json.before-build-fix-$Stamp"
Copy-Item $PackageFile $Backup -Force

$Package = Get-Content $PackageFile -Raw | ConvertFrom-Json
if ($null -eq $Package.scripts) {
    $Package | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{})
}

# Vercel's linked project is currently asking for `npm run build`.
# This site is served directly (Express backend + public static files), so
# there is no compilation step. This harmless script satisfies that command.
$BuildCommand = 'node -e "console.log(''SPP Express app: no compilation step required'')"'
if ($Package.scripts.PSObject.Properties.Name -contains 'build') {
    $Package.scripts.build = $BuildCommand
} else {
    $Package.scripts | Add-Member -MemberType NoteProperty -Name build -Value $BuildCommand
}

# Never restore the recursive `dev: vercel dev` entry.
if ($Package.scripts.PSObject.Properties.Name -contains 'dev' -and $Package.scripts.dev -eq 'vercel dev') {
    $Package.scripts.PSObject.Properties.Remove('dev')
}

$Json = $Package | ConvertTo-Json -Depth 50
[System.IO.File]::WriteAllText($PackageFile, $Json, [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host 'SPP build-script correction completed.' -ForegroundColor Green
Write-Host "Backup: $Backup"
Write-Host 'Added a harmless build script; the Express server remains the application entry point.'
Write-Host 'The recursive dev script has not been restored.'
Write-Host ''
Write-Host 'Next run:' -ForegroundColor Cyan
Write-Host '  npm run build'
Write-Host '  npx vercel@latest dev'
