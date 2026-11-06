# Shoto Point Production - robust live CMS installer v3
# Targets the active Music-folder project. Preserves .env, package.json and MySQL data.
$ErrorActionPreference = 'Stop'
$Project = Join-Path $env:USERPROFILE 'Music\Shoto_Point_Production_HTML_JS_Node'
$Patch = $PSScriptRoot

if (!(Test-Path (Join-Path $Project 'server.js')) -or !(Test-Path (Join-Path $Project 'package.json'))) {
    throw "Active project not found at $Project. Do not run this from the Documents copy."
}
foreach ($required in @('index_admin.html','Adminlogin.html','app2.js','config2.js')) {
    if (!(Test-Path (Join-Path $Project $required))) { throw "Required main Admin file is missing: $required" }
}
foreach ($required in @('spp-cms-live.js','spp-cms-public.js','spp-cms-live.css','newsroom.js','news-article.html','cms-page.html','index.html','SYFM(2).html')) {
    if (!(Test-Path (Join-Path $Patch $required))) { throw "Patch asset is missing beside this installer: $required. Extract the complete ZIP into the project folder." }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = Join-Path $Project "_spp-cms-backup-$stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Write-Host "Preparing live CMS integration in $Project" -ForegroundColor Cyan

# Back up only files this installer may change.
$backupNames = @('server.js','index_admin.html','Adminlogin.html','index.html','SYFM(2).html','news.html','newsroom.js','news-article.html','cms-page.html','spp-cms-live.js','spp-cms-public.js','spp-cms-live.css','style2.css','styles2.css')
foreach ($name in $backupNames) {
    $source = Join-Path $Project $name
    if (Test-Path -LiteralPath $source) {
        $destination = Join-Path $Backup $name
        $parent = Split-Path -Parent $destination
        if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }
}

# Back up every root HTML page too, because the public renderer is injected into them below.
Get-ChildItem -LiteralPath $Project -Filter '*.html' -File | ForEach-Object {
    $destination = Join-Path $Backup $_.Name
    if (!(Test-Path -LiteralPath $destination)) {
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    }
}

function Copy-IfDifferent([string]$Source, [string]$Destination) {
    $srcFull = [System.IO.Path]::GetFullPath($Source)
    $dstFull = [System.IO.Path]::GetFullPath($Destination)
    if ([string]::Equals($srcFull,$dstFull,[System.StringComparison]::OrdinalIgnoreCase)) { return }
    Copy-Item -LiteralPath $srcFull -Destination $dstFull -Force
}

# Install integration assets. Copy-IfDifferent avoids the self-copy failure from v1.
foreach ($name in @('spp-cms-live.js','spp-cms-public.js','spp-cms-live.css','newsroom.js','news-article.html','cms-page.html','index.html','SYFM(2).html')) {
    Copy-IfDifferent (Join-Path $Patch $name) (Join-Path $Project $name)
}

# Keep the requested main Admin stylesheet filename.
$style = Join-Path $Project 'style2.css'
if (!(Test-Path $style)) {
    $alternate = Join-Path $Project 'styles2.css'
    if (Test-Path $alternate) { Copy-IfDifferent $alternate $style }
    else { throw 'Neither style2.css nor styles2.css exists. The original Admin styling is required.' }
}

# Prepare server changes in memory first. Nothing is written until syntax validation passes.
$ServerPath = Join-Path $Project 'server.js'
$server = Get-Content -LiteralPath $ServerPath -Raw
if ($server -notmatch 'mysql\.createPool') { throw 'The current server.js does not contain the expected MySQL pool. No server changes were saved.' }
$uploadMatch = [regex]::Match($server, '(?m)^\s*(?:const|let|var)\s+upload\s*=\s*multer\s*\(')
if (!$uploadMatch.Success) { throw 'Could not locate the upload middleware in server.js. No server changes were saved.' }

# Attach the MySQL pool for the public newsroom handler.
if ($server -notmatch 'app\.locals\.sppDb\s*=\s*db') {
    $server = $server.Insert($uploadMatch.Index, "app.locals.sppDb=db;`r`n")
}

# Mount the MySQL-aware newsroom API before legacy route handlers.
if ($server -notmatch 'SPP_CMS_NEWSROOM_OVERRIDE') {
    $marker = 'app.locals.sppDb=db;'
    if (!$server.Contains($marker)) { throw 'Could not attach the database pool to Express. No server changes were saved.' }
    $newsroomMount = @'
// SPP_CMS_NEWSROOM_OVERRIDE: use MySQL-backed SPP Originals plus licensed external RSS feeds.
const sppCmsNewsroomHandler=require('./newsroom');
app.use('/api/public/newsroom',(req,res,next)=>{
 if(req.method!=='GET') return next();
 return sppCmsNewsroomHandler(req,res,next);
});
'@
    $server = $server.Replace($marker, $marker + "`r`n" + $newsroomMount.TrimEnd())
}

# Add an idempotent schema migration inside ensureCMSV3. Older cms_menus tables
# are not altered by CREATE TABLE IF NOT EXISTS, which caused the missing slug error.
if ($server -notmatch 'SPP_CMS_MENU_SCHEMA_MIGRATION') {
    $cmsInitMarker = '  for(const q of statements) await db.query(q);'
    if (!$server.Contains($cmsInitMarker)) { throw 'Could not locate the CMS schema initialization loop. No server changes were saved.' }
    $cmsMenuMigration = @'
  // SPP_CMS_MENU_SCHEMA_MIGRATION: upgrade an existing cms_menus table safely.
  const [[menuSlugColumn]] = await db.query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cms_menus' AND COLUMN_NAME='slug'");
  if (!Number(menuSlugColumn.c)) await db.query("ALTER TABLE cms_menus ADD COLUMN slug VARCHAR(180) NULL AFTER name");
  const [[menuCreatedByColumn]] = await db.query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cms_menus' AND COLUMN_NAME='created_by'");
  if (!Number(menuCreatedByColumn.c)) await db.query("ALTER TABLE cms_menus ADD COLUMN created_by INT NULL");
  const [[menuUpdatedByColumn]] = await db.query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cms_menus' AND COLUMN_NAME='updated_by'");
  if (!Number(menuUpdatedByColumn.c)) await db.query("ALTER TABLE cms_menus ADD COLUMN updated_by INT NULL");
  await db.query("UPDATE cms_menus SET slug=CONCAT(COALESCE(NULLIF(TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(COALESCE(name,'menu'),'[^a-zA-Z0-9]+','-'))),''),'menu'),'-',id) WHERE slug IS NULL OR TRIM(slug)=''");
  await db.query("ALTER TABLE cms_menus MODIFY COLUMN slug VARCHAR(180) NOT NULL");
  const [[menuSlugUniqueIndex]] = await db.query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cms_menus' AND COLUMN_NAME='slug' AND NON_UNIQUE=0");
  if (!Number(menuSlugUniqueIndex.c)) await db.query("CREATE UNIQUE INDEX ux_cms_menus_slug ON cms_menus(slug)");
'@
    $server = $server.Replace($cmsInitMarker, $cmsInitMarker + "`r`n" + $cmsMenuMigration.TrimEnd())
}


# Publish scheduled CMS blocks when due. The timer is unref'd and does not keep Node alive.
if ($server -notmatch 'SPP_CMS_SCHEDULE_TIMER') {
    $timer = @'
// SPP_CMS_SCHEDULE_TIMER: publish scheduled CMS blocks once their scheduled time arrives.
if (!global.SPP_CMS_SCHEDULE_TIMER) {
 global.SPP_CMS_SCHEDULE_TIMER=setInterval(()=>{
  db.query("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()").catch(()=>{});
 },30000);
 global.SPP_CMS_SCHEDULE_TIMER.unref?.();
}
'@
    $uploadMatch = [regex]::Match($server, '(?m)^\s*(?:const|let|var)\s+upload\s*=\s*multer\s*\(')
    $server = $server.Insert($uploadMatch.Index, $timer.TrimEnd() + "`r`n")
}

# Allow the SYFM public menu location in the existing public menu API.
$allowedMatch = [regex]::Match($server, 'const\s+allowedLocations\s*=\s*new Set\(\[([^\]]*)\]\)')
if ($allowedMatch.Success -and $allowedMatch.Groups[1].Value -notmatch 'syfm') {
    $newItems = $allowedMatch.Groups[1].Value.TrimEnd() + ",'syfm'"
    $server = $server.Remove($allowedMatch.Groups[1].Index,$allowedMatch.Groups[1].Length).Insert($allowedMatch.Groups[1].Index,$newItems)
}

# Scheduled is a first-class publishing state; do not auto-publish drafts merely because they have a date.
$server = $server.Replace("WHERE status='draft' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()", "WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()")

# Permit social links for every team profile (not only a hard-coded administrator name).
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) ? (b.whatsapp_url||null) : null', '(b.whatsapp_url||null)')
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) ? (b.social_json ? JSON.stringify(b.social_json) : null) : null', '(b.social_json ? JSON.stringify(b.social_json) : null)')
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) && b.show_social ? 1 : 0', 'b.show_social ? 1 : 0')

# Add a dedicated bulk publish endpoint for page sections if the base server lacks one.
if ($server -notmatch 'SPP_CMS_PUBLISH_SECTION') {
    $contentRoute = [regex]::Match($server, 'app\.get\(\s*[''"]\/api\/public\/cms\/content[''"]')
    if (!$contentRoute.Success) { throw 'The existing public CMS content route was not found. No server changes were saved.' }
    $publishRoute = @'
app.post('/api/admin/cms/content-blocks/publish-section',auth,async(req,res)=>{try{
 const section=String(req.body?.section||'').trim();
 if(!section)return res.status(400).json({error:'A page section is required.'});
 const [r]=await db.execute("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW(),updated_by=? WHERE section=? AND (scheduled_at IS NULL OR scheduled_at<=NOW()) AND status IN ('draft','pending_review','scheduled')",[req.admin.id,section]);
 await cmsAudit(req,'publish','content_section',section,{published:r.affectedRows});
 res.json({success:true,published:r.affectedRows});
}catch(e){res.status(400).json({error:e.message})}});
// SPP_CMS_PUBLISH_SECTION
'@
    $server = $server.Insert($contentRoute.Index, $publishRoute + "`r`n")
}

# Verify public-facing APIs and existing CMS CRUD are present before saving.
foreach ($route in @('/api/admin/cms/content-blocks','/api/admin/cms/menus','/api/admin/team','/api/public/team','/api/public/cms/content','/api/public/cms/menus')) {
    if ($server.IndexOf($route,[System.StringComparison]::Ordinal) -lt 0) { throw "Required API route is missing in server.js: $route. No server changes were saved." }
}

# Write a temporary server file and ask Node to parse it. Save only if valid.
$tempServer = Join-Path $Project 'server.spp-cms-validation.tmp.js'
Set-Content -LiteralPath $tempServer -Value $server -Encoding UTF8
& node --check $tempServer
$nodeExit = $LASTEXITCODE
Remove-Item -LiteralPath $tempServer -Force -ErrorAction SilentlyContinue
if ($nodeExit -ne 0) { throw 'Patched server.js failed Node syntax validation. Original server.js was preserved.' }
Set-Content -LiteralPath $ServerPath -Value $server -Encoding UTF8

# Fix the existing Admin asset references; do not replace its design.
$AdminPath = Join-Path $Project 'index_admin.html'
$admin = Get-Content -LiteralPath $AdminPath -Raw
$admin = $admin -replace 'src=["'']config\.js["'']', 'src="config2.js"'
$admin = $admin -replace 'src=["'']app\.js["'']', 'src="app2.js"'
$admin = $admin -replace 'href=["'']styles2\.css["'']', 'href="style2.css"'
if ($admin -notmatch 'spp-cms-live\.css') { $admin = $admin -replace '</head>', "<link rel=`"stylesheet`" href=`"spp-cms-live.css`">`r`n</head>" }
if ($admin -notmatch 'spp-cms-live\.js') { $admin = $admin -replace '</body>', "<script src=`"spp-cms-live.js`"></script>`r`n</body>" }
Set-Content -LiteralPath $AdminPath -Value $admin -Encoding UTF8

# Keep login redirect pointed at the selected Admin page.
$LoginPath = Join-Path $Project 'Adminlogin.html'
$login = Get-Content -LiteralPath $LoginPath -Raw
$login = $login.Replace('admin-control-centre.html','index_admin.html')
Set-Content -LiteralPath $LoginPath -Value $login -Encoding UTF8

# Ensure other root public pages can render CMS page sections without changing their visual design.
$excluded = @('index_admin.html','Adminlogin.html','admin.html','admin-control-centre.html','digital-operations-centre-v5.2-prototype.html','news.html','news-article.html','SYFM.html','SYFM(2).html')
Get-ChildItem -LiteralPath $Project -Filter '*.html' -File | Where-Object { $excluded -notcontains $_.Name } | ForEach-Object {
    $pagePath = $_.FullName
    $html = Get-Content -LiteralPath $pagePath -Raw
    if ($html -notmatch 'spp-cms-public\.js') {
        $slug = $_.BaseName.ToLowerInvariant() -replace '[^a-z0-9]+','-'
        if ($html -notmatch 'id=["'']sppCmsPageContent["'']') {
            $mainIndex = $html.LastIndexOf('</main>',[System.StringComparison]::OrdinalIgnoreCase)
            if ($mainIndex -ge 0) { $html = $html.Insert($mainIndex,'<section id="sppCmsPageContent" class="spp-cms-slot" hidden></section>') }
        }
        if ($html -notmatch 'spp-cms-live\.css') {
            $headIndex = $html.LastIndexOf('</head>',[System.StringComparison]::OrdinalIgnoreCase)
            if ($headIndex -ge 0) { $html = $html.Insert($headIndex,'<link rel="stylesheet" href="/spp-cms-live.css">') }
        }
        $tag = "<script src=`"/spp-cms-public.js`" data-spp-page=`"$slug`"></script>"
        $bodyIndex = $html.LastIndexOf('</body>',[System.StringComparison]::OrdinalIgnoreCase)
        if ($bodyIndex -ge 0) { $html = $html.Insert($bodyIndex,$tag) } else { $html += $tag }
        Set-Content -LiteralPath $pagePath -Value $html -Encoding UTF8
    }
}

# Final checks.
Write-Host "`nMAIN ADMIN / CMS FILE CHECK" -ForegroundColor Cyan
@('index_admin.html','style2.css','app2.js','config2.js','server.js','spp-cms-live.js','spp-cms-public.js','spp-cms-live.css','newsroom.js','news-article.html','cms-page.html','index.html','SYFM(2).html') | ForEach-Object {
    Write-Host ("{0}: {1}" -f $_,(Test-Path (Join-Path $Project $_)))
}
node --check (Join-Path $Project 'server.js')
node --check (Join-Path $Project 'newsroom.js')
node --check (Join-Path $Project 'spp-cms-live.js')
node --check (Join-Path $Project 'spp-cms-public.js')
Write-Host "`nLIVE CMS UPDATE v3 INSTALLED SUCCESSFULLY." -ForegroundColor Green
Write-Host "Backup created at: $Backup"
Write-Host 'Restart the project using: npm start'
Write-Host 'No placeholder Team rows were deleted; manage existing profiles safely from Admin > Team Management.'
