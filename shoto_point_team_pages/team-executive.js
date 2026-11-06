/* Team branch pages use the same card structure as executive-team.html.
   CMS/API data is used when available; role slots remain visible as a safe fallback. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const group = document.body.dataset.teamGroup;
  const grid = document.getElementById('teamCards');
  const year = document.getElementById('currentYear');
  if (year) year.textContent = new Date().getFullYear();
  if (!grid || !['administrative', 'senior'].includes(group)) return;

  const placeholder = '../assets/team-placeholder.jpg';
  const profiles = {
    administrative: [
      {
        role: 'HEAD OF ICT',
        department: 'ICT & DIGITAL INFRASTRUCTURE',
        title: 'Head of ICT',
        short: 'Leads the company’s technology infrastructure, websites, internal platforms, technical support, connectivity and information security.',
        bio: 'The Head of ICT is responsible for the reliability and development of Shoto Point Productions’ technology environment. The role oversees website and platform maintenance, user support, computer systems, connectivity, data protection, access control, backups and the technical tools used by the organisation. The department works with production, administration and creative teams to ensure that technology supports the company’s daily operations and long-term growth.',
        image: placeholder
      },
      {
        role: 'HEAD OF MEDIA',
        department: 'MEDIA & CREATIVE OPERATIONS',
        title: 'Head of Media',
        short: 'Leads media strategy, content production, editorial quality, production coordination and public communication.',
        bio: 'The Head of Media leads the planning and delivery of the company’s media activities. Responsibilities include production development, editorial standards, content planning, media personnel coordination, photography and video operations, communications support and quality control. The department works across film, television, documentary, commercial and digital productions.',
        image: placeholder
      }
    ],
    senior: [
      { role: 'PUBLIC RELATIONS OFFICER (PRO)', department: 'PUBLIC RELATIONS & CORPORATE AFFAIRS', title: 'Public Relations Officer', short: 'Coordinates public relations, stakeholder communication, announcements, media relations and institutional relationships.', bio: 'The Public Relations Officer manages the company’s public image and external communication. The role coordinates announcements, media enquiries, stakeholder engagement, official correspondence and public-facing information while ensuring that communications are accurate and consistent.' },
      { role: 'SOUND ENGINEER', department: 'AUDIO ENGINEERING & SOUND', title: 'Sound Engineer', short: 'Manages sound recording, location audio, mixing, live sound, voice recording and audio equipment standards.', bio: 'The Sound Engineer is responsible for the technical quality of audio across productions. Duties include recording dialogue and environmental sound, preparing microphones and recording equipment, managing live sound, editing and mixing audio, monitoring levels and delivering clean, consistent sound files.' },
      { role: 'SOCIAL MEDIA CONTROLLER', department: 'DIGITAL & SOCIAL MEDIA', title: 'Social Media Controller', short: 'Coordinates social channels, content calendars, publishing, community engagement and digital performance reporting.', bio: 'The Social Media Controller plans and coordinates the company’s social media activity. Responsibilities include content scheduling, platform administration, audience engagement, moderation, campaign coordination, analytics and reporting on digital performance.' },
      { role: 'PRODUCTION COORDINATOR', department: 'PRODUCTION OPERATIONS', title: 'Production Coordinator', short: 'Coordinates schedules, locations, crew logistics, production documents, call sheets and daily production delivery.', bio: 'The Production Coordinator supports the practical organisation of productions. The role maintains schedules, coordinates locations and crew movements, prepares production documents, tracks requirements and communicates changes between departments to keep projects organised.' },
      { role: 'DIRECTOR OF PHOTOGRAPHY', department: 'CINEMATOGRAPHY & CAMERA', title: 'Director of Photography', short: 'Leads visual composition, camera operation, lighting direction, shot planning and cinematography standards.', bio: 'The Director of Photography leads the visual execution of a production in collaboration with the director. Responsibilities include camera and lens choices, lighting plans, shot composition, exposure, camera movement and maintaining visual continuity across scenes.' },
      { role: 'VIDEO EDITOR', department: 'POST-PRODUCTION & EDITING', title: 'Video Editor', short: 'Edits footage, manages timelines, synchronises sound, prepares versions and supports final audio-visual delivery.', bio: 'The Video Editor assembles recorded footage into finished stories and deliverables. Duties include reviewing footage, organising media, editing picture and sound, applying transitions and titles, maintaining versions, preparing exports and coordinating revisions.' },
      { role: 'GRAPHICS DESIGNER', department: 'CREATIVE DESIGN & BRANDING', title: 'Graphics Designer', short: 'Creates visual identities, posters, promotional artwork, layouts, titles and digital design assets.', bio: 'The Graphics Designer develops visual materials that support the company’s brand and productions. The role creates posters, title graphics, promotional designs, layouts, social media artwork and other visual assets while maintaining consistency with approved brand guidelines.' },
      { role: 'SCRIPTWRITER & STORY EDITOR', department: 'SCRIPT & STORY DEVELOPMENT', title: 'Scriptwriter & Story Editor', short: 'Develops scripts, reviews story structure, checks continuity, refines dialogue and prepares production drafts.', bio: 'The Scriptwriter and Story Editor develops and refines written material for the company’s productions. Responsibilities include story research, outlines, screenplay drafts, dialogue development, script revisions, continuity checks and preparing approved scripts for production.' },
      { role: 'PRODUCTION MANAGER', department: 'PRODUCTION MANAGEMENT', title: 'Production Manager', short: 'Manages production resources, budgets, department coordination, procurement and project execution.', bio: 'The Production Manager oversees the operational and financial coordination of productions. Duties include budget tracking, resource planning, procurement coordination, schedule monitoring, department communication, logistics and reporting on project delivery.' },
      { role: 'TECHNICAL DIRECTOR', department: 'TECHNICAL OPERATIONS', title: 'Technical Director', short: 'Oversees production technology, equipment readiness, technical workflows, connectivity and system reliability.', bio: 'The Technical Director ensures that the technical systems used by the company are fit for purpose. Responsibilities include equipment planning, technical setup, camera and audio support, connectivity, troubleshooting, workflow design, maintenance schedules and technical quality assurance.' }
    ].map(item => ({ ...item, image: placeholder }))
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function safeImage(value) {
    const image = String(value || '').trim();
    if (!image) return placeholder;
    if (/^(https?:)?\/\//i.test(image) || image.startsWith('/')) return image;
    if (image.startsWith('../')) return image;
    if (image.startsWith('assets/')) return `../${image}`;
    return placeholder;
  }

  function mergeProfile(base, source = {}) {
    const candidateName = String(source.name || '').trim();
    const placeholderName = !candidateName || /^(name to be updated|senior team position\s*\d+|member\s*(one|two|three|four|five))$/i.test(candidateName);
    return {
      ...base,
      ...source,
      title: placeholderName ? base.title : candidateName,
      role: base.role,
      department: base.department,
      short: source.short_bio || source.short || base.short,
      bio: source.biography || source.bio || base.bio,
      image: safeImage(source.image_url || source.image || base.image)
    };
  }

  function render(rows = []) {
    const slots = profiles[group];
    const members = slots.map((base, index) => {
      const matched = rows.find(row => String(row.role || '').trim().toLowerCase() === base.role.toLowerCase());
      return mergeProfile(base, matched || rows[index] || {});
    });
    grid.innerHTML = members.map((member, index) => {
      const params = new URLSearchParams({ group, member: String(index) });
      return `
        <article class="leader-card">
          <div class="portrait-wrap">
            <img src="${escapeHtml(member.image)}" alt="${escapeHtml(member.title)}" loading="lazy" onerror="this.onerror=null;this.src='../assets/team-placeholder.jpg';">
          </div>
          <div class="leader-content">
            <span class="role">${escapeHtml(member.role)}</span>
            <p class="team-department">${escapeHtml(member.department)}</p>
            <h2>${escapeHtml(member.title)}</h2>
            <p>${escapeHtml(member.short)}</p>
            <a class="read-more" href="team-biography.html?${params.toString()}">Read More <span>→</span></a>
          </div>
        </article>`;
    }).join('');
  }

  render();
  fetch('/api/public/team?group=' + encodeURIComponent(group), {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Team directory unavailable')))
    .then(payload => render(Array.isArray(payload.data) ? payload.data : []))
    .catch(() => { /* Keep the complete local team directory visible when the API is unavailable. */ });

  const video = document.querySelector('.video-bg video');
  if (video) {
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    });
  }
});
