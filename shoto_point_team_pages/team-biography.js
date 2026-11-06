/* Individual administrative and senior biographies, styled to match ceo-biography.html. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const query = new URLSearchParams(window.location.search);
  let group = query.get('group');
  const memberIndex = Number.parseInt(query.get('member') || '0', 10);
  const profileId = Number.parseInt(query.get('id') || '0', 10);
  const allowedGroups = ['administrative', 'senior'];
  const root = document.getElementById('teamProfile');
  const imageEl = document.getElementById('profileImage');
  const roleEl = document.getElementById('profileRole');
  const nameEl = document.getElementById('profileName');
  const leadEl = document.getElementById('profileLead');
  const departmentEl = document.getElementById('profileDepartment');
  const biographyEl = document.getElementById('profileBiography');
  const contributionEl = document.getElementById('profileContribution');
  const backLink = document.getElementById('backToTeam');
  const backButton = document.getElementById('profileBackButton');

  const groups = {
    administrative: [
      { role:'HEAD OF ICT', department:'ICT & DIGITAL INFRASTRUCTURE', title:'Head of ICT', short:'Leads the company’s technology infrastructure, websites, internal platforms, technical support, connectivity and information security.', bio:'The Head of ICT is responsible for the reliability and development of Shoto Point Productions’ technology environment. The role oversees website and platform maintenance, user support, computer systems, connectivity, data protection, access control, backups and the technical tools used by the organisation. The department works with production, administration and creative teams to ensure that technology supports the company’s daily operations and long-term growth.' },
      { role:'HEAD OF MEDIA', department:'MEDIA & CREATIVE OPERATIONS', title:'Head of Media', short:'Leads media strategy, content production, editorial quality, production coordination and public communication.', bio:'The Head of Media leads the planning and delivery of the company’s media activities. Responsibilities include production development, editorial standards, content planning, media personnel coordination, photography and video operations, communications support and quality control. The department works across film, television, documentary, commercial and digital productions.' }
    ],
    senior: [
      { role:'PUBLIC RELATIONS OFFICER (PRO)', department:'PUBLIC RELATIONS & CORPORATE AFFAIRS', title:'Public Relations Officer', short:'Coordinates public relations, stakeholder communication, announcements, media relations and institutional relationships.', bio:'The Public Relations Officer manages the company’s public image and external communication. The role coordinates announcements, media enquiries, stakeholder engagement, official correspondence and public-facing information while ensuring that communications are accurate and consistent.' },
      { role:'SOUND ENGINEER', department:'AUDIO ENGINEERING & SOUND', title:'Sound Engineer', short:'Manages sound recording, location audio, mixing, live sound, voice recording and audio equipment standards.', bio:'The Sound Engineer is responsible for the technical quality of audio across productions. Duties include recording dialogue and environmental sound, preparing microphones and recording equipment, managing live sound, editing and mixing audio, monitoring levels and delivering clean, consistent sound files.' },
      { role:'SOCIAL MEDIA CONTROLLER', department:'DIGITAL & SOCIAL MEDIA', title:'Social Media Controller', short:'Coordinates social channels, content calendars, publishing, community engagement and digital performance reporting.', bio:'The Social Media Controller plans and coordinates the company’s social media activity. Responsibilities include content scheduling, platform administration, audience engagement, moderation, campaign coordination, analytics and reporting on digital performance.' },
      { role:'PRODUCTION COORDINATOR', department:'PRODUCTION OPERATIONS', title:'Production Coordinator', short:'Coordinates schedules, locations, crew logistics, production documents, call sheets and daily production delivery.', bio:'The Production Coordinator supports the practical organisation of productions. The role maintains schedules, coordinates locations and crew movements, prepares production documents, tracks requirements and communicates changes between departments to keep projects organised.' },
      { role:'DIRECTOR OF PHOTOGRAPHY', department:'CINEMATOGRAPHY & CAMERA', title:'Director of Photography', short:'Leads visual composition, camera operation, lighting direction, shot planning and cinematography standards.', bio:'The Director of Photography leads the visual execution of a production in collaboration with the director. Responsibilities include camera and lens choices, lighting plans, shot composition, exposure, camera movement and maintaining visual continuity across scenes.' },
      { role:'VIDEO EDITOR', department:'POST-PRODUCTION & EDITING', title:'Video Editor', short:'Edits footage, manages timelines, synchronises sound, prepares versions and supports final audio-visual delivery.', bio:'The Video Editor assembles recorded footage into finished stories and deliverables. Duties include reviewing footage, organising media, editing picture and sound, applying transitions and titles, maintaining versions, preparing exports and coordinating revisions.' },
      { role:'GRAPHICS DESIGNER', department:'CREATIVE DESIGN & BRANDING', title:'Graphics Designer', short:'Creates visual identities, posters, promotional artwork, layouts, titles and digital design assets.', bio:'The Graphics Designer develops visual materials that support the company’s brand and productions. The role creates posters, title graphics, promotional designs, layouts, social media artwork and other visual assets while maintaining consistency with approved brand guidelines.' },
      { role:'SCRIPTWRITER & STORY EDITOR', department:'SCRIPT & STORY DEVELOPMENT', title:'Scriptwriter & Story Editor', short:'Develops scripts, reviews story structure, checks continuity, refines dialogue and prepares production drafts.', bio:'The Scriptwriter and Story Editor develops and refines written material for the company’s productions. Responsibilities include story research, outlines, screenplay drafts, dialogue development, script revisions, continuity checks and preparing approved scripts for production.' },
      { role:'PRODUCTION MANAGER', department:'PRODUCTION MANAGEMENT', title:'Production Manager', short:'Manages production resources, budgets, department coordination, procurement and project execution.', bio:'The Production Manager oversees the operational and financial coordination of productions. Duties include budget tracking, resource planning, procurement coordination, schedule monitoring, department communication, logistics and reporting on project delivery.' },
      { role:'TECHNICAL DIRECTOR', department:'TECHNICAL OPERATIONS', title:'Technical Director', short:'Oversees production technology, equipment readiness, technical workflows, connectivity and system reliability.', bio:'The Technical Director ensures that the technical systems used by the company are fit for purpose. Responsibilities include equipment planning, technical setup, camera and audio support, connectivity, troubleshooting, workflow design, maintenance schedules and technical quality assurance.' }
    ]
  };

  const escapeText = value => String(value ?? '').trim();
  function normalizeImage(value) {
    const image = escapeText(value);
    if (!image) return '../assets/team-placeholder.jpg';
    if (/^(https?:)?\/\//i.test(image) || image.startsWith('/')) return image;
    if (image.startsWith('../')) return image;
    if (image.startsWith('assets/')) return '../' + image;
    return '../assets/team-placeholder.jpg';
  }

  if (!profileId && (!allowedGroups.includes(group) || !Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex >= (groups[group] || []).length)) {
    root.innerHTML = '<div class="bio-section"><h2>Profile unavailable</h2><p>Please return to the team directory and select a valid profile.</p><p><a class="btn primary" href="administrative.html">Return to Administrative Team</a></p></div>';
    return;
  }

  const pageUrl = group === 'senior' ? 'senior-teams.html' : 'administrative.html';
  backLink.href = pageUrl;
  backButton.href = pageUrl;

  function render(base, source = {}) {
    const sourceName = escapeText(source.name);
    const isPlaceholder = !sourceName || /^(name to be updated|senior team position\s*\d+|member\s*(one|two|three|four|five))$/i.test(sourceName);
    const displayName = isPlaceholder ? base.title : sourceName;
    const role = base.role;
    const department = base.department;
    const lead = escapeText(source.short_bio || source.short || base.short);
    const bio = escapeText(source.biography || source.bio || base.bio);
    const image = normalizeImage(source.image_url || source.image);

    document.title = `${displayName} | Shoto Point Productions`;
    imageEl.src = image;
    imageEl.alt = displayName;
    imageEl.onerror = () => { imageEl.onerror = null; imageEl.src = '../assets/team-placeholder.jpg'; };
    roleEl.textContent = role;
    nameEl.textContent = displayName;
    leadEl.textContent = lead;
    departmentEl.textContent = department;
    biographyEl.textContent = bio;
    contributionEl.textContent = `${displayName} works with the Executive Team, Administrative Team and other departments to support professional standards, reliable delivery, collaboration and the overall objectives of Shoto Point Productions. The profile holder’s approved personal details and portrait can be updated through the company’s team administration process.`;
  }

  if (profileId > 0) {
    roleEl.textContent = 'TEAM PROFILE';
    nameEl.textContent = 'Loading profile…';
    leadEl.textContent = 'Loading team biography…';
    fetch('/api/public/team?id=' + encodeURIComponent(profileId), { headers: { Accept:'application/json' }, cache:'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Team profile service unavailable')))
      .then(payload => {
        const source = Array.isArray(payload.data) ? payload.data[0] : null;
        if (!source) throw new Error('Team member not found.');
        const detectedGroup = allowedGroups.includes(source.group_key) ? source.group_key : 'senior';
        group = detectedGroup;
        const matched = (groups[detectedGroup] || []).find(item => String(item.role).toLowerCase() === String(source.role || '').toLowerCase());
        const base = matched || { role:source.role || 'TEAM MEMBER', department:source.department || 'TEAM DEPARTMENT', title:source.name || 'Team Member', short:source.short_bio || '', bio:source.biography || source.short_bio || '' };
        const destination = detectedGroup === 'senior' ? 'senior-teams.html' : 'administrative.html';
        backLink.href = destination;
        backButton.href = destination;
        render(base, source);
      })
      .catch(error => { nameEl.textContent = 'Profile unavailable'; leadEl.textContent = error.message || 'The requested team profile could not be loaded.'; });
  } else {
    const base = groups[group][memberIndex];
    render(base);
    fetch('/api/public/team?group=' + encodeURIComponent(group), { headers: { Accept:'application/json' }, cache:'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Team profile service unavailable')))
      .then(payload => {
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const matched = rows.find(row => String(row.role || '').trim().toLowerCase() === base.role.toLowerCase());
        render(base, matched || rows[memberIndex] || {});
      })
      .catch(() => { /* The profile remains available using its local role description. */ });
  }

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
