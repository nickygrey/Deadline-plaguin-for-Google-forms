/**
 * Setup:
 * 1) Enter your Calendar ID (or leave 'primary')
 * 2) Check the question titles in FORM_FIELDS
 * 3) Adjust the deadline logic in computeDeadline_()
 */

const CALENDAR_ID = 'plotnikovvyacheslav2@gmail.com'; // or a specific calendarId
const TIMEZONE = 'Europe/Paris';

const FORM_FIELDS = {
  clientName: 'Name and Surname',
  projectName: 'Project Name',
  deadlineDays: 'Deadline in days', // e.g. 3, 5, 10
  package: 'Package', // e.g. "Express / Standard / Premium"
  email: 'Email'
};

function onFormSubmit(e) {
  // e.namedValues = { "Question": ["Answer"] }
  const nv = getNamedValues_(e);
  if (!Object.keys(nv).length) {
    console.warn('Form submit event data is missing. Ensure this is run by an onFormSubmit trigger.');
    return;
  }
  const get = (q) => (nv[q] && nv[q][0]) ? nv[q][0].trim() : '';

  const clientName = get(FORM_FIELDS.clientName) || 'No name';
  const projectName = get(FORM_FIELDS.projectName) || 'No project';
  const email = get(FORM_FIELDS.email);

  // Option A: client selects "Deadline (days)" directly
  const daysRaw = get(FORM_FIELDS.deadlineDays);
  // Option B: deadline depends on selected package
  const pkg = get(FORM_FIELDS.package);

  const now = new Date();
  const deadline = computeDeadline_(now, daysRaw, pkg);

  const title = `Deadline: ${clientName} — ${projectName}`;
  const descriptionLines = [
    `Client: ${clientName}`,
    `Project: ${projectName}`,
    email ? `Email: ${email}` : null,
    pkg ? `Package: ${pkg}` : null,
    daysRaw ? `Deadline (days): ${daysRaw}` : null,
    `Created from Google Forms: ${format_(now)}`
  ].filter(Boolean);

  const cal = CalendarApp.getCalendarById(CALENDAR_ID);

  // All-day event on the deadline date:
  cal.createAllDayEvent(title, deadline, { description: descriptionLines.join('\n') });

  // If you want a timed event, e.g. at 18:00:
  // const dueAt = new Date(deadline);
  // dueAt.setHours(18, 0, 0, 0);
  // const end = new Date(dueAt); end.setMinutes(end.getMinutes() + 30);
  // cal.createEvent(title, dueAt, end, { description: descriptionLines.join('\n') });
}

function computeDeadline_(submittedAt, daysRaw, pkg) {
  // 1) If a number of days is provided, use it
  const days = parseInt(daysRaw, 10);
  if (!isNaN(days) && days > 0) {
    // Simple approach: calendar days
    const d = new Date(submittedAt);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // 2) If no number, calculate based on package (example)
  // Customize as needed:
  const map = {
    Express: 2,
    Standard: 5,
    Premium: 10
  };
  const addDays = map[pkg] || 5;

  // Example: business days only (no Sat/Sun)
  return addBusinessDays_(submittedAt, addDays);
}

function getNamedValues_(e) {
  if (e && e.namedValues) {
    return e.namedValues;
  }
  if (e && e.response && typeof e.response.getItemResponses === 'function') {
    return e.response.getItemResponses().reduce((acc, itemResponse) => {
      const item = itemResponse.getItem();
      const title = item && typeof item.getTitle === 'function' ? item.getTitle() : '';
      if (title) {
        acc[title] = [String(itemResponse.getResponse()).trim()];
      }
      return acc;
    }, {});
  }
  return {};
}

function addBusinessDays_(date, businessDaysToAdd) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  let added = 0;
  while (added < businessDaysToAdd) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

function format_(date) {
  return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd HH:mm');
}
