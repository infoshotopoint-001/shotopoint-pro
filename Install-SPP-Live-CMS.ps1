# Shoto Point Production - live MySQL CMS / Team / SYFM / News publishing installer.
# Preserves the current design, .env, package.json and database. A timestamped backup is created.
$ErrorActionPreference = 'Stop'
$Project = Join-Path $env:USERPROFILE 'Music\Shoto_Point_Production_HTML_JS_Node'
if (!(Test-Path (Join-Path $Project 'server.js')) -or !(Test-Path (Join-Path $Project 'package.json'))) {
    Write-Host "Cannot find the active Shoto Point project at: $Project" -ForegroundColor Red
    Write-Host 'Edit the $Project line in this script if your real project is stored elsewhere.'
    exit 1
}
foreach ($required in @('index_admin.html','Adminlogin.html','app2.js','config2.js')) {
    if (!(Test-Path (Join-Path $Project $required))) { throw "Required existing project file is missing: $required. Do not continue against a partial project." }
}
$Patch = $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Backup = Join-Path $Project "_spp-cms-backup-$stamp"
New-Item -ItemType Directory -Path $Backup -Force | Out-Null
Write-Host "Preparing live CMS integration in $Project" -ForegroundColor Cyan

# Back up current server/admin/public files before changing them.
$backupNames = @('server.js','index_admin.html','Adminlogin.html','index.html','SYFM(2).html','newsroom.js','news-article.html','cms-page.html','style2.css','styles2.css')
foreach ($name in $backupNames) {
    $path = Join-Path $Project $name
    if (Test-Path $path) { Copy-Item -LiteralPath $path -Destination (Join-Path $Backup $name) -Force }
}
$skipPublic = @('index_admin.html','Adminlogin.html','admin.html','admin-control-centre.html','digital-operations-centre-v5.2-prototype.html','news.html','news-article.html','SYFM.html','SYFM(2).html')
Get-ChildItem -LiteralPath $Project -Filter '*.html' -File | Where-Object { $skipPublic -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Backup $_.Name) -Force
}

# Install live integration scripts and public newsroom article template.
foreach ($name in @('spp-cms-live.js','spp-cms-public.js','spp-cms-live.css','newsroom.js','news-article.html','cms-page.html')) {
    $source = Join-Path $Patch $name
    if (!(Test-Path $source)) { throw "Patch file is missing: $name" }
    $destination = Join-Path $Project $name
    $sourceFull = [System.IO.Path]::GetFullPath($source)
    $destinationFull = [System.IO.Path]::GetFullPath($destination)

    if (-not [string]::Equals(
        $sourceFull,
        $destinationFull,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Copy-Item -LiteralPath $sourceFull -Destination $destinationFull -Force
    }
}
# Keep the supplied Shoto Point public homepage and SYFM page; no prototype dashboard is copied.
foreach ($name in @('index.html','SYFM(2).html')) {
    $source = Join-Path $Patch $name
    if (!(Test-Path $source)) { throw "Updated public page is missing: $name" }
    $destination = Join-Path $Project $name
    $sourceFull = [System.IO.Path]::GetFullPath($source)
    $destinationFull = [System.IO.Path]::GetFullPath($destination)

    if (-not [string]::Equals(
        $sourceFull,
        $destinationFull,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Copy-Item -LiteralPath $sourceFull -Destination $destinationFull -Force
    }
}
# The original upload calls this styles2.css; the requested current Admin filename is style2.css.
$style2 = Join-Path $Project 'style2.css'
if (!(Test-Path $style2)) {
    if (Test-Path (Join-Path $Project 'styles2.css')) { Copy-Item (Join-Path $Project 'styles2.css') $style2 -Force }
    else { throw 'Neither style2.css nor styles2.css exists. The original Admin styling is required.' }
}

# Patch the current Node server IN PLACE. Existing routes, middleware, static serving and DB settings are preserved.
$ServerPath = Join-Path $Project 'server.js'
$server = Get-Content -LiteralPath $ServerPath -Raw
if ($server -notmatch 'app\.locals\.sppDb\s*=\s*db') {
    $anchor = 'const upload=multer('
    if (!$server.Contains($anchor)) { throw 'Could not locate the MySQL pool section in server.js.' }
    $server = $server.Replace($anchor, "app.locals.sppDb=db;`r`n$anchor")
}
# The CMS-aware newsroom middleware is registered before legacy newsroom GET handlers,
# so it always supplies original SPP articles from MySQL while preserving external RSS feeds.
if ($server -notmatch 'SPP_CMS_NEWSROOM_OVERRIDE') {
    $anchor = 'app.locals.sppDb=db;'
    $override = @'
app.locals.sppDb=db;
// SPP_CMS_NEWSROOM_OVERRIDE: give the MySQL-backed newsroom handler precedence over legacy handlers.
if (!global.SPP_CMS_NEWSROOM_OVERRIDE) {
 const sppNewsroomHandler=require('./newsroom');
 app.use('/api/public/newsroom',(req,res,next)=>{
  if(req.method==='GET') return sppNewsroomHandler(req,res,next);
  return next();
 });
 global.SPP_CMS_NEWSROOM_OVERRIDE=true;
}
'@
    $server = $server.Replace($anchor, $override.TrimEnd())
}
# Attach the DB pool and automatically publish due scheduled CMS blocks.
if ($server -notmatch 'SPP_CMS_SCHEDULE_TIMER') {
    $timer = @'
// SPP_CMS_SCHEDULE_TIMER: publish scheduled content when its publication time arrives.
if (!global.SPP_CMS_SCHEDULE_TIMER) {
 global.SPP_CMS_SCHEDULE_TIMER=setInterval(()=>{
  db.query("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW() WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()").catch(()=>{});
 },30000);
 global.SPP_CMS_SCHEDULE_TIMER.unref?.();
}
'@
    $anchor = 'const upload=multer({'
    if ($server.Contains($anchor)) { $server = $server.Replace($anchor, $timer.TrimEnd() + "`r`n" + $anchor) }
    else { throw 'Could not insert the publishing scheduler before media routes.' }
}
# Support SYFM as a public CMS navigation location.
$server = $server -replace "new Set\(\['header','footer','nav','sidebar','production','photography','news'\]\)", "new Set(['header','footer','nav','sidebar','production','photography','news','syfm'])"
# Update the administrator-triggered schedule processor to publish only records explicitly marked Scheduled when due.
$server = $server -replace "WHERE status='draft' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW\(\)", "WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=NOW()"
# Remove exact starter placeholder profiles even if the Team table already contained other rows.
if ($server -notmatch 'SPP_REMOVE_PLACEHOLDER_TEAM_ROWS_GLOBAL') {
    $startupAnchor = 'await Promise.all([ensureTeamTable(),ensureCMSV3(),ensureProductionTables(),ensureProductionExperienceTables()]);'
    if (!$server.Contains($startupAnchor)) { throw 'Could not locate database startup initialisation for placeholder cleanup.' }
    $cleanupGlobal = @'
  // SPP_REMOVE_PLACEHOLDER_TEAM_ROWS_GLOBAL: remove only exact names from the original starter seed.
  await db.query("DELETE FROM team_members WHERE name IN ('CEO Name','Co-Founder Name','Creative Producer','Director of Photography','Sound Lead','Talent Coordinator','Senior Team Member Five')");
  // Keep existing CMS menu rows aligned with the actual public Team and SYFM page routes.
  // Align only the original starter navigation labels/links; administrator-created custom roots are retained.
  await db.query("UPDATE cms_menus SET name='Service',url='/cms-page.html?page=service' WHERE location='header' AND parent_id IS NULL AND slug='services'");
  await db.query("UPDATE cms_menus SET name='Our Story',url='/OurStories.html' WHERE location='header' AND parent_id IS NULL AND slug='our-stories'");
  await db.query("UPDATE cms_menus SET url='/About.html' WHERE location='header' AND parent_id IS NULL AND name='About'");
  await db.query("UPDATE cms_menus SET url='/index.html' WHERE location='header' AND parent_id IS NULL AND name='Home'");
  await db.query("UPDATE cms_menus SET url='/Production.html' WHERE location='header' AND parent_id IS NULL AND name='Production'");
  await db.query("UPDATE cms_menus SET url='/OurWebsites.html' WHERE location='header' AND parent_id IS NULL AND name='Our Webs'");
  await db.query("UPDATE cms_menus SET url='/HaveAStory.html' WHERE location='header' AND parent_id IS NULL AND name='Contact'");
  await db.query("UPDATE cms_menus SET url='/shoto_point_team_pages/ceo.html' WHERE location='header' AND parent_id IS NULL AND name='Team'");
  await db.query("UPDATE cms_menus child JOIN cms_menus parent ON parent.id=child.parent_id SET child.url=CASE child.name WHEN 'Executive' THEN '/shoto_point_team_pages/ceo.html' WHEN 'Administrative' THEN '/shoto_point_team_pages/administrative.html' WHEN 'Senior' THEN '/shoto_point_team_pages/senior-teams.html' ELSE child.url END WHERE child.location='header' AND parent.location='header' AND parent.name='Team' AND child.name IN ('Executive','Administrative','Senior')");
  await db.query("UPDATE cms_menus child JOIN cms_menus parent ON parent.id=child.parent_id SET child.name='Shoto News',child.url='/news.html' WHERE child.location='header' AND parent.location='header' AND parent.name='Our Webs' AND child.name='Our News'");
  await db.query("UPDATE cms_menus child JOIN cms_menus parent ON parent.id=child.parent_id SET child.url='/SYFM(2).html' WHERE child.location='header' AND parent.location='header' AND parent.name='Our Webs' AND child.name='SYFM'");
  await db.query("DELETE child FROM cms_menus child JOIN cms_menus parent ON parent.id=child.parent_id WHERE child.location='header' AND parent.location='header' AND parent.slug IN ('live-session','news','start-a-project')");
  await db.query("DELETE FROM cms_menus WHERE location='header' AND parent_id IS NULL AND slug IN ('live-session','news','start-a-project')");
  await db.query("UPDATE cms_menus SET url=CASE name WHEN 'Home' THEN '#home' WHEN 'About' THEN '#about' WHEN 'Vision' THEN '#vision' WHEN 'Programmes' THEN '#programmes' WHEN 'Leadership' THEN '#leadership' WHEN 'Public Affairs' THEN '#public-affairs' WHEN 'Membership' THEN '#membership' WHEN 'Events' THEN '#events' WHEN 'News' THEN '#news' WHEN 'Gallery' THEN '#gallery' WHEN 'Contact' THEN '#contact' WHEN 'JOIN SYFM' THEN '/MemberShip.html' ELSE url END WHERE location='syfm' AND name IN ('Home','About','Vision','Programmes','Leadership','Public Affairs','Membership','Events','News','Gallery','Contact','JOIN SYFM')");
'@
    $server = $server.Replace($startupAnchor, $startupAnchor + "`r`n" + $cleanupGlobal.TrimEnd())
}
# Remove only known sample Team records; keep all other named profiles.
$teamAnchor = 'await db.query("UPDATE team_members SET show_social=0, whatsapp_url=NULL, social_json=NULL WHERE LOWER(name) NOT LIKE ''%deevinitee%''");'
if ($server.Contains($teamAnchor) -and $server -notmatch 'SPP_REMOVE_PLACEHOLDER_TEAM_ROWS') {
    $cleanup = @'
await db.query("UPDATE team_members SET show_social=0, whatsapp_url=NULL, social_json=NULL WHERE LOWER(name) NOT LIKE '%deevinitee%'");
  // SPP_REMOVE_PLACEHOLDER_TEAM_ROWS: delete only exact demo names from the starter seed.
  await db.query("DELETE FROM team_members WHERE name IN ('CEO Name','Co-Founder Name','Creative Producer','Director of Photography','Sound Lead','Talent Coordinator','Senior Team Member Five')");
'@
    $server = $server.Replace($teamAnchor, $cleanup.TrimEnd())
}
# Enable social fields for all team profiles, rather than restricting them to one named profile.
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) ? (b.whatsapp_url||null) : null', '(b.whatsapp_url||null)')
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) ? (b.social_json ? JSON.stringify(b.social_json) : null) : null', '(b.social_json ? JSON.stringify(b.social_json) : null)')
$server = $server.Replace('/deevinitee/i.test(String(b.name||"")) && b.show_social ? 1 : 0', 'b.show_social ? 1 : 0')
# Add a bulk publish action for page/section blocks. Future scheduled content remains scheduled.
if ($server -notmatch 'SPP_CMS_PUBLISH_SECTION') {
    $anchor = "app.get('/api/public/cms/content',async(req,res)=>{try{"
    if (!$server.Contains($anchor)) { throw 'Could not locate public CMS content route for the section publishing API.' }
    $route = @'
app.post('/api/admin/cms/content-blocks/publish-section',auth,async(req,res)=>{try{
 const section=String(req.body?.section||'').trim();
 if(!section)return res.status(400).json({error:'A page section is required.'});
 const [r]=await db.execute("UPDATE cms_content_blocks SET status='published',published_at=COALESCE(published_at,NOW()),updated_at=NOW(),updated_by=? WHERE section=? AND (scheduled_at IS NULL OR scheduled_at<=NOW()) AND status IN ('draft','pending_review','scheduled')",[req.admin.id,section]);
 await cmsAudit(req,'publish','content_section',section,{published:r.affectedRows});
 res.json({success:true,published:r.affectedRows});
}catch(e){res.status(400).json({error:e.message})}});
// SPP_CMS_PUBLISH_SECTION
'@
    $server = $server.Replace($anchor, $route.TrimEnd() + "`r`n" + $anchor)
}
Set-Content -LiteralPath $ServerPath -Value $server -Encoding UTF8

# Make sure the existing Admin design loads the correct existing JS/CSS filenames and the live CMS layer.
$AdminPath = Join-Path $Project 'index_admin.html'
$admin = Get-Content -LiteralPath $AdminPath -Raw
$admin = $admin -replace 'src=["'']config\.js["'']', 'src="config2.js"'
$admin = $admin -replace 'src=["'']app\.js["'']', 'src="app2.js"'
$admin = $admin -replace 'href=["'']styles2\.css["'']', 'href="style2.css"'
if ($admin -notmatch 'spp-cms-live\.css') { $admin = $admin -replace '</head>', "<link rel=`"stylesheet`" href=`"spp-cms-live.css`">`r`n</head>" }
if ($admin -notmatch 'spp-cms-live\.js') { $admin = $admin -replace '</body>', "<script src=`"spp-cms-live.js`"></script>`r`n</body>" }
Set-Content -LiteralPath $AdminPath -Value $admin -Encoding UTF8

# Keep login on the chosen index_admin.html entry point.
$LoginPath = Join-Path $Project 'Adminlogin.html'
$login = Get-Content -LiteralPath $LoginPath -Raw
$login = $login.Replace('admin-control-centre.html','index_admin.html')
Set-Content -LiteralPath $LoginPath -Value $login -Encoding UTF8

# Apply CMS content rendering to every other root-level public HTML page without replacing its design.
$excluded = @('index_admin.html','Adminlogin.html','admin.html','admin-control-centre.html','digital-operations-centre-v5.2-prototype.html','news.html','news-article.html','SYFM.html','SYFM(2).html')
Get-ChildItem -LiteralPath $Project -Filter '*.html' -File | Where-Object { $excluded -notcontains $_.Name } | ForEach-Object {
    $pagePath = $_.FullName
    $html = Get-Content -LiteralPath $pagePath -Raw
    if ($html -notmatch 'spp-cms-public\.js') {
        $slug = $_.BaseName.ToLowerInvariant() -replace '[^a-z0-9]+','-'
        $slot = '<section id="sppCmsPageContent" class="spp-cms-slot" hidden></section>'
        if ($html -notmatch 'id=["'']sppCmsPageContent["'']') {
            $index = $html.LastIndexOf('</main>',[System.StringComparison]::OrdinalIgnoreCase)
            if ($index -ge 0) { $html = $html.Insert($index,$slot) }
        }
        if ($html -notmatch 'spp-cms-live\.css') {
            $headIndex = $html.LastIndexOf('</head>',[System.StringComparison]::OrdinalIgnoreCase)
            if ($headIndex -ge 0) { $html = $html.Insert($headIndex,'<link rel="stylesheet" href="/spp-cms-live.css">') }
        }
        $scriptTag = "<script src=`"/spp-cms-public.js`" data-spp-page=`"$slug`"></script>"
        $bodyIndex = $html.LastIndexOf('</body>',[System.StringComparison]::OrdinalIgnoreCase)
        if ($bodyIndex -ge 0) { $html = $html.Insert($bodyIndex,$scriptTag) } else { $html += $scriptTag }
        Set-Content -LiteralPath $pagePath -Value $html -Encoding UTF8
    }
}

# Validate the files that will be used by the active app.
Write-Host "`nMAIN FILE CHECK" -ForegroundColor Cyan
@('index_admin.html','style2.css','app2.js','config2.js','server.js','spp-cms-live.js','spp-cms-public.js','newsroom.js','news-article.html','cms-page.html','index.html','SYFM(2).html') | ForEach-Object {
    Write-Host ("{0}: {1}" -f $_,(Test-Path (Join-Path $Project $_)))
}
Write-Host "`nChecking JavaScript syntax..." -ForegroundColor Cyan
node --check $ServerPath
node --check (Join-Path $Project 'newsroom.js')
node --check (Join-Path $Project 'spp-cms-live.js')
node --check (Join-Path $Project 'spp-cms-public.js')
Write-Host "`nLIVE CMS UPDATE INSTALLED." -ForegroundColor Green
Write-Host "Backup created at: $Backup"
Write-Host 'Restart the project with: npm start'

