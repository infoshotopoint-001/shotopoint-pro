$ErrorActionPreference = 'Stop'
$root = Get-Location
$bridge = '<link rel="stylesheet" href="/spp-cms.css">' + "`r`n" + '<script src="/spp-cms.js" defer></script>'
$backup = Join-Path $root ('.spp-cms-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
$files = Get-ChildItem -Path $root -File -Filter '*.html' | Where-Object {
  $_.Name -notmatch '^(?i:SYFM)' -and
  $_.Name -notin @('Adminlogin.html','admin-control-centre.html')
}
$changed = 0
foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  if ($content -match 'spp-cms\.js') { continue }
  Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $backup $file.Name)
  if ($content -match '</head>') { $content = $content -replace '</head>', ($bridge + "`r`n</head>") }
  elseif ($content -match '</body>') { $content = $content -replace '</body>', ($bridge + "`r`n</body>") }
  else { Write-Warning "Skipped $($file.Name): no </head> or </body> tag."; continue }
  Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8
  $changed++
}
Write-Host "SPP CMS bridge installed on $changed HTML page(s)." -ForegroundColor Green
Write-Host "Backup folder: $backup"
Write-Host 'SYFM*.html and the SYFM folder were not modified.' -ForegroundColor Yellow
