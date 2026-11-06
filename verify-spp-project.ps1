$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
Write-Host "Checking Shoto Point Production project: $root" -ForegroundColor Cyan
$required = @(
  'package.json','server.js','vercel.json','Adminlogin.html','admin-control-centre.html',
  'admin-control-centre.js','api\[...all].js','api\public\newsroom.js',
  'spp-cms.js','spp-cms.css','database\shoto_point_admin.sql',
  'install-spp-cms.ps1','index.html','SYFM4.html'
)
$missing = @()
foreach ($item in $required) {
  if (Test-Path -LiteralPath (Join-Path $root $item)) { Write-Host "OK   $item" -ForegroundColor Green }
  else { Write-Host "MISS $item" -ForegroundColor Red; $missing += $item }
}
if ($missing.Count -gt 0) {
  Write-Warning 'One or more files are missing. Confirm you are in C:\Users\USER\Documents\SHOTO POINT PRO and have merged the SPP package.'
  exit 1
}
Write-Host "`nNPM project root:" -ForegroundColor Cyan
npm prefix
Write-Host "`nDependency tree (rss-parser should be listed):" -ForegroundColor Cyan
npm ls rss-parser --depth=0
Write-Host "`nProject structure checks passed. Database, R2 and provider credentials still require configuration." -ForegroundColor Green
