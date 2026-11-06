/* Team member profile page — visual layout follows ceo-biography.html. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const id = Number.parseInt(params.get('id') || '0', 10);
  const roleEl = document.getElementById('teamMemberRole');
  const nameEl = document.getElementById('teamMemberName');
  const leadEl = document.getElementById('teamMemberLead');
  const departmentEl = document.getElementById('teamMemberDepartment');
  const biographyEl = document.getElementById('teamMemberBiography');
  const contributionEl = document.getElementById('teamMemberContribution');
  const imageEl = document.getElementById('teamMemberImage');
  const backLink = document.getElementById('teamBackLink');
  const returnButton = document.getElementById('teamReturnButton');

  if (!Number.isInteger(id) || id <= 0) {
    nameEl.textContent = 'Profile not selected';
    leadEl.textContent = 'Return to the team directory and select a team member.';
    biographyEl.textContent = 'No team member ID was supplied.';
    return;
  }

  const fallbackImage = 'assets/team-placeholder.jpg';
  function imagePath(value) {
    const src = String(value || '').trim();
    if (!src) return fallbackImage;
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) return src;
    if (src.startsWith('../')) return src;
    if (src.startsWith('assets/')) return src;
    return fallbackImage;
  }

  fetch('/api/public/team?id=' + encodeURIComponent(id), {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load team profile.')))
    .then(payload => {
      const member = Array.isArray(payload.data) ? payload.data[0] : null;
      if (!member) throw new Error('Team member not found or profile is not published.');

      const name = String(member.name || 'Team Member').trim();
      const role = String(member.role || 'TEAM MEMBER').trim();
      const department = String(member.department || 'Team Department').trim();
      const group = String(member.group_key || '').toLowerCase();
      const destination = group === 'administrative'
        ? 'shoto_point_team_pages/administrative.html'
        : group === 'senior'
          ? 'shoto_point_team_pages/senior-teams.html'
          : group === 'ceo'
            ? 'executive-team.html'
            : 'index.html#team';

      document.title = `${name} | Shoto Point Productions`;
      roleEl.textContent = role;
      nameEl.textContent = name;
      leadEl.textContent = String(member.short_bio || 'Shoto Point Productions team profile.');
      departmentEl.textContent = department;
      biographyEl.textContent = String(member.biography || member.short_bio || 'The full biography will be updated by the team administration.');
      contributionEl.textContent = `${name} contributes to the company through the responsibilities of the ${role.toLowerCase()} role. The position works with the Executive Team, Administrative Team and other departments to support professional standards, collaboration and dependable project delivery.`;
      imageEl.src = imagePath(member.image_url);
      imageEl.alt = `${name} — ${role}`;
      imageEl.onerror = () => { imageEl.onerror = null; imageEl.src = fallbackImage; };
      backLink.href = destination;
      returnButton.href = destination;
    })
    .catch(error => {
      nameEl.textContent = 'Profile unavailable';
      leadEl.textContent = error.message || 'The team profile could not be loaded.';
      biographyEl.textContent = 'Please return to the team directory and try again.';
    });
});
