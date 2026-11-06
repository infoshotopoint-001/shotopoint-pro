document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const group = document.body.dataset.teamGroup;
  const grid = document.getElementById('teamGrid');
  const modal = document.getElementById('bioModal');
  const roleEl = document.getElementById('modalRole');
  const nameEl = document.getElementById('modalName');
  const bioEl = document.getElementById('modalBio');
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  if (!grid || !group) return;

  const fallback = {
    ceo: [
      { role:'CHIEF EXECUTIVE OFFICER', department:'EXECUTIVE OFFICE', name:'Name to be updated', short:'Provides strategic direction, protects the company vision and builds relationships for sustainable growth.', bio:'The Chief Executive Officer provides overall leadership, strategic direction, governance and partnership development.', image_url:'/assets/ceo.jpg' },
      { role:'CHIEF OPERATING OFFICER', department:'OPERATIONS OFFICE', name:'Name to be updated', short:'Leads daily operations, coordinates departments and turns strategy into measurable execution.', bio:'The Chief Operating Officer oversees business operations, performance, internal systems and cross-department delivery.', image_url:'/assets/coo.jpg' }
    ],
    administrative: [
      { role:'HEAD OF ICT', department:'ICT & DIGITAL INFRASTRUCTURE', name:'Name to be updated', short:'Leads technology infrastructure, digital platforms, technical support and information security.', bio:'The Head of ICT oversees technology infrastructure, digital platforms, system reliability, technical support and information security.', image_url:'/assets/team-placeholder.jpg' },
      { role:'HEAD OF MEDIA', department:'MEDIA & CREATIVE OPERATIONS', name:'Name to be updated', short:'Leads media strategy, content production, editorial quality and public communication.', bio:'The Head of Media leads production planning, storytelling, media operations, editorial presentation and public communication.', image_url:'/assets/team-placeholder.jpg' }
    ],
    senior: [
      { role:'PUBLIC RELATIONS OFFICER (PRO)', department:'PUBLIC RELATIONS & CORPORATE AFFAIRS', short:'Coordinates public relations, stakeholder communication, announcements and institutional relationships.' },
      { role:'SOUND ENGINEER', department:'AUDIO ENGINEERING & SOUND', short:'Manages recording, sound capture, mixing, live audio and audio equipment standards.' },
      { role:'SOCIAL MEDIA CONTROLLER', department:'DIGITAL & SOCIAL MEDIA', short:'Coordinates social channels, publishing calendars, audience engagement and digital reporting.' },
      { role:'PRODUCTION COORDINATOR', department:'PRODUCTION OPERATIONS', short:'Coordinates schedules, locations, crew logistics, production documents and daily delivery.' },
      { role:'DIRECTOR OF PHOTOGRAPHY', department:'CINEMATOGRAPHY & CAMERA', short:'Leads visual composition, camera operation, lighting direction and cinematography standards.' },
      { role:'VIDEO EDITOR', department:'POST-PRODUCTION & EDITING', short:'Edits footage, manages timelines, prepares versions and supports final audio-visual delivery.' },
      { role:'GRAPHICS DESIGNER', department:'CREATIVE DESIGN & BRANDING', short:'Creates visual identities, posters, promotional artwork, layouts and digital design assets.' },
      { role:'SCRIPTWRITER & STORY EDITOR', department:'SCRIPT & STORY DEVELOPMENT', short:'Develops scripts, reviews story structure, checks continuity and prepares production drafts.' },
      { role:'PRODUCTION MANAGER', department:'PRODUCTION MANAGEMENT', short:'Manages production resources, budgets, department coordination and project execution.' },
      { role:'TECHNICAL DIRECTOR', department:'TECHNICAL OPERATIONS', short:'Oversees technical systems, equipment readiness, connectivity and production technology.' }
    ].map((item, i) => ({ ...item, name:`Senior Team Position ${String(i + 1).padStart(2, '0')}`, bio:item.short, image_url:'/assets/team-placeholder.jpg' }))
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[char]);

  function openBio(member) {
    if (!modal) return;
    roleEl.textContent = member.role || '';
    nameEl.textContent = member.name || 'Team profile';
    bioEl.textContent = [member.department ? `Department: ${member.department}` : '', member.biography || member.bio || member.short_bio || member.short || 'Profile information will be updated.'].filter(Boolean).join('\n\n');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeBio() {
    modal?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeBio));
  modal?.addEventListener('click', event => { if (event.target === modal) closeBio(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeBio(); });

  function normalizeRows(rows) {
    const slots = fallback[group] || [];
    if (!slots.length) return rows || [];
    return slots.map((base, index) => {
      const source = (rows || [])[index] || {};
      const rowName = String(source.name || '').trim();
      const nameLooksPlaceholder = !rowName || /^(CEO NAME|COO NAME|ICT HEAD NAME|MEDIA HEAD NAME|MEMBER (ONE|TWO|THREE|FOUR|FIVE))$/i.test(rowName);
      return {
        ...base,
        ...source,
        name: nameLooksPlaceholder ? base.name : rowName,
        role: (!source.role || /^(SENIOR TEAM MEMBER|SENIOR)$/i.test(String(source.role).trim())) ? base.role : source.role,
        department: base.department || source.department || '',
        short: source.short_bio || source.short || base.short || '',
        short_bio: source.short_bio || base.short || '',
        biography: source.biography || base.biography || base.bio || base.short || '',
        image_url: (() => { const image = source.image_url || base.image_url || '/assets/team-placeholder.jpg'; return /^assets\//i.test(image) ? '../' + image : image; })()
      };
    });
  }

  function render(rows) {
    const members = normalizeRows(rows);
    grid.innerHTML = members.map((member, index) => {
      const id = Number(member.id) || 0;
      const image = member.image_url || '/assets/team-placeholder.jpg';
      const short = member.short_bio || member.short || '';
      return `<article class="team-card" data-index="${index}" data-id="${id}" data-role="${escapeHtml(member.role)}" data-name="${escapeHtml(member.name)}" data-department="${escapeHtml(member.department)}" data-bio="${escapeHtml(member.biography || short)}">
        <div class="card-inner">
          <img class="member-photo" src="${escapeHtml(image)}" alt="${escapeHtml(member.name)}" loading="lazy" onerror="this.onerror=null;this.src='/assets/team-placeholder.jpg';">
          <div class="member-role">${escapeHtml(member.role)}</div>
          ${member.department ? `<div class="member-department">${escapeHtml(member.department)}</div>` : ''}
          <h2 class="member-name">${escapeHtml(member.name || 'Name to be updated')}</h2>
          <p class="member-description">${escapeHtml(short)}</p>
          <div class="card-actions"><button class="btn btn-ghost quick-bio" type="button">Quick Bio</button>${id ? `<a class="btn btn-primary read-more" href="team-member.html?id=${encodeURIComponent(id)}">Read More</a>` : `<button class="btn btn-primary read-more" type="button">Read More</button>`}</div>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('.quick-bio, .read-more[type="button"]').forEach(button => button.addEventListener('click', () => {
      const card = button.closest('.team-card');
      openBio({ role:card.dataset.role, name:card.dataset.name, department:card.dataset.department, biography:card.dataset.bio });
    }));
  }

  fetch('/api/public/team?group=' + encodeURIComponent(group), { headers:{ Accept:'application/json' }, cache:'no-store' })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Team API unavailable')))
    .then(payload => render(Array.isArray(payload.data) ? payload.data : []))
    .catch(() => render([]));

  const video = document.querySelector('.team-background video');
  if (video) { video.muted = true; video.playsInline = true; video.play().catch(() => {}); }
});
