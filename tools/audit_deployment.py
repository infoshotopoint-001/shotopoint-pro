from pathlib import Path
import subprocess,re,json,sys
root=Path(__file__).resolve().parents[1]
report=[]
php=list(root.rglob('*.php')); js=list(root.rglob('*.js'))
php=[p for p in php if 'node_modules' not in p.parts]
js=[p for p in js if 'node_modules' not in p.parts]
php_fail=[]; js_fail=[]
for p in php:
    r=subprocess.run(['php','-l',str(p)],capture_output=True,text=True)
    if r.returncode: php_fail.append((str(p.relative_to(root)),r.stdout+r.stderr))
for p in js:
    r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
    if r.returncode: js_fail.append((str(p.relative_to(root)),r.stdout+r.stderr))
texts=[]
for p in root.rglob('*'):
    if p.is_file() and 'node_modules' not in p.parts and p.suffix.lower() in {'.php','.js','.html','.json','.css','.sql','.conf','.sh'}:
        try:texts.append((p,p.read_text(errors='ignore')))
        except:pass
joined='\n'.join(t for _,t in texts)
local_refs=sorted({str(p.relative_to(root)) for p,t in texts if p.name not in {'apache-vhost.conf'} and re.search(r'127\.0\.0\.1:5000|localhost:5000',t)})
secrets=sorted({str(p.relative_to(root)) for p,t in texts if re.search(r'sk_(?:test|live)_[A-Za-z0-9]+(?!_REPLACE_ME)|pk_(?:test|live)_[A-Za-z0-9]+(?!_REPLACE_ME)',t)})
required=['server.js','index.php','admin-control-centre.php','admin-control-centre.js','SYFM(2).html','submit-news.php','checkout.html','checkout-api.js','payment-callback.php','Dockerfile.vercel','vercel.json','.env.example','database/production-deployment-schema.sql','deploy/apache-vhost.conf','deploy/supervisord.conf','deploy/entrypoint.sh','assets/team-background.mp4','assets/business-meeting.mp4','assets/ceo.jpg','assets/coo.jpg']
missing=[x for x in required if not (root/x).exists()]
# old duplicate servers
server_paths=[str(p.relative_to(root)) for p in root.rglob('server.js') if 'node_modules' not in p.parts]
report.append(f'PHP files checked: {len(php)}; syntax failures: {len(php_fail)}')
report.append(f'JavaScript files checked: {len(js)}; syntax failures: {len(js_fail)}')
report.append(f'Browser/localhost:5000 references: {len(local_refs)}')
report.append(f'Potential Paystack secret patterns in source: {len(secrets)}')
report.append(f'Required deployment files missing: {len(missing)}')
report.append('Canonical server.js files: '+', '.join(server_paths))
report.append('')
if php_fail: report += ['PHP FAIL '+str(x) for x in php_fail]
if js_fail: report += ['JS FAIL '+str(x) for x in js_fail]
if local_refs: report += ['LOCAL REF '+x for x in local_refs]
if secrets: report += ['SECRET '+x for x in secrets]
if missing: report += ['MISSING '+x for x in missing]
Path(root/'AUDIT_REPORT.md').write_text('# Shoto Point Production Automated Audit\n\n'+'\n'.join('- '+x for x in report)+'\n\n## Interpretation\n\nStatic checks cover syntax, secret leakage patterns, localhost browser dependencies and required deployment files. Live MySQL, Paystack and SMTP checks require the production provider credentials and are therefore not falsely marked as 100% live-tested here.\n')
print('\n'.join(report))
