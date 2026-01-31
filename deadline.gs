/**
 * Setup:
 * 1) Enter your Calendar ID (or leave 'primary')
 * 2) Create a Google Sheet and paste its ID in SPREADSHEET_ID
 * 3) Run setupDashboard() once to create the dashboard sheet
 * 4) Run installDailyTrigger() once to enable automated follow-ups
 * 5) Check the question titles in FORM_FIELDS
 * 6) Adjust the deadline logic in computeDeadline_()
 */

const CALENDAR_ID = 'plotnikovvyacheslav2@gmail.com'; // or a specific calendarId
const TIMEZONE = 'Europe/Paris';
const SPREADSHEET_ID = ''; // PASTE YOUR GOOGLE SHEET ID HERE
const SHEET_NAME = 'Project Deadlines';
const ADMIN_EMAIL = 'plotnikovvyacheslav2@gmail.com'; // Email for notifications

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
  const event = cal.createAllDayEvent(title, deadline, { description: descriptionLines.join('\n') });
  const eventId = event.getId();

  // Log to Google Sheets dashboard
  logToSpreadsheet_(clientName, projectName, email, pkg, daysRaw, now, deadline, eventId);

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

// ============================================================================
// GOOGLE SHEETS DASHBOARD
// ============================================================================

/**
 * Run this once to create the dashboard sheet with headers
 */
function setupDashboard() {
  if (!SPREADSHEET_ID) {
    throw new Error('Please set SPREADSHEET_ID in the configuration');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Set up headers
  const headers = [
    'Created Date',
    'Client Name',
    'Project Name',
    'Email',
    'Package',
    'Days',
    'Deadline',
    'Status',
    'Last Updated',
    'Event ID'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Add data validation for Status column (column 8)
  const statusRange = sheet.getRange(2, 8, 1000, 1);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'In Progress', 'Completed', 'Overdue'], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusRule);

  Logger.log('Dashboard setup complete!');
}

/**
 * Logs a new deadline to the spreadsheet
 */
function logToSpreadsheet_(clientName, projectName, email, pkg, days, createdDate, deadline, eventId) {
  if (!SPREADSHEET_ID) {
    Logger.log('SPREADSHEET_ID not configured, skipping sheet logging');
    return;
  }

  try {
    const sheet = getSheet_();
    if (!sheet) return;

    const row = [
      format_(createdDate),
      clientName,
      projectName,
      email || '',
      pkg || '',
      days || '',
      Utilities.formatDate(deadline, TIMEZONE, 'yyyy-MM-dd'),
      'Pending',
      format_(new Date()),
      eventId
    ];

    sheet.appendRow(row);

    // Apply conditional formatting to the new row
    const lastRow = sheet.getLastRow();
    const statusCell = sheet.getRange(lastRow, 8);

    // Color code status
    colorCodeStatus_(statusCell, 'Pending');

    Logger.log(`Logged to spreadsheet: ${clientName} - ${projectName}`);
  } catch (error) {
    Logger.log(`Error logging to spreadsheet: ${error.message}`);
  }
}

/**
 * Helper to get the dashboard sheet
 */
function getSheet_() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log(`Sheet "${SHEET_NAME}" not found. Run setupDashboard() first.`);
      return null;
    }
    return sheet;
  } catch (error) {
    Logger.log(`Error accessing spreadsheet: ${error.message}`);
    return null;
  }
}

/**
 * Apply color coding based on status
 */
function colorCodeStatus_(cell, status) {
  const colors = {
    'Pending': '#fff3cd',      // Yellow
    'In Progress': '#cfe2ff',  // Blue
    'Completed': '#d1e7dd',    // Green
    'Overdue': '#f8d7da'       // Red
  };
  cell.setBackground(colors[status] || '#ffffff');
}

// ============================================================================
// AUTOMATED STATUS UPDATES & FOLLOW-UPS
// ============================================================================

/**
 * Updates project statuses based on current date
 * Call this manually or via trigger
 */
function updateProjectStatuses() {
  const sheet = getSheet_();
  if (!sheet) return;

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let updatedCount = 0;

  // Start from row 2 (skip headers)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const deadlineStr = row[6]; // Deadline column
    const currentStatus = row[7]; // Status column

    if (!deadlineStr || currentStatus === 'Completed') {
      continue; // Skip if no deadline or already completed
    }

    const deadline = new Date(deadlineStr);
    deadline.setHours(0, 0, 0, 0);

    let newStatus = currentStatus;

    // Check if overdue
    if (deadline < today && currentStatus !== 'Overdue') {
      newStatus = 'Overdue';
    } else if (deadline >= today && currentStatus === 'Overdue') {
      // Reset from overdue if deadline was extended
      newStatus = 'Pending';
    }

    // Update if status changed
    if (newStatus !== currentStatus) {
      const statusCell = sheet.getRange(i + 1, 8);
      statusCell.setValue(newStatus);
      colorCodeStatus_(statusCell, newStatus);

      // Update "Last Updated" column
      sheet.getRange(i + 1, 9).setValue(format_(new Date()));

      updatedCount++;
    }
  }

  Logger.log(`Updated ${updatedCount} project statuses`);
  return updatedCount;
}

/**
 * Main function that runs daily to check deadlines and send follow-ups
 * This is triggered automatically
 */
function dailyDeadlineCheck() {
  Logger.log('Starting daily deadline check...');

  // First, update all statuses
  updateProjectStatuses();

  // Then send follow-up emails
  sendFollowUpEmails();

  Logger.log('Daily deadline check complete');
}

/**
 * Sends follow-up emails for upcoming and overdue deadlines
 */
function sendFollowUpEmails() {
  const sheet = getSheet_();
  if (!sheet) return;

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingDeadlines = [];
  const overdueProjects = [];
  const dueTodayProjects = [];

  // Start from row 2 (skip headers)
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const clientName = row[1];
    const projectName = row[2];
    const clientEmail = row[3];
    const deadlineStr = row[6];
    const status = row[7];

    if (!deadlineStr || status === 'Completed') {
      continue;
    }

    const deadline = new Date(deadlineStr);
    deadline.setHours(0, 0, 0, 0);

    const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    // Categorize projects
    if (daysUntil < 0) {
      overdueProjects.push({ clientName, projectName, clientEmail, daysOverdue: Math.abs(daysUntil) });
    } else if (daysUntil === 0) {
      dueTodayProjects.push({ clientName, projectName, clientEmail });
    } else if (daysUntil <= 3) {
      upcomingDeadlines.push({ clientName, projectName, clientEmail, daysUntil });
    }
  }

  // Send admin summary email
  sendAdminSummary_(upcomingDeadlines, overdueProjects, dueTodayProjects);

  // Send client reminders for due today and upcoming (optional)
  sendClientReminders_(upcomingDeadlines, dueTodayProjects);

  Logger.log(`Follow-ups sent: ${overdueProjects.length} overdue, ${dueTodayProjects.length} due today, ${upcomingDeadlines.length} upcoming`);
}

/**
 * Sends a daily summary email to the admin
 */
function sendAdminSummary_(upcoming, overdue, dueToday) {
  if (!ADMIN_EMAIL) {
    Logger.log('ADMIN_EMAIL not configured, skipping admin summary');
    return;
  }

  if (upcoming.length === 0 && overdue.length === 0 && dueToday.length === 0) {
    Logger.log('No deadlines to report');
    return;
  }

  let emailBody = 'Daily Deadline Report\n';
  emailBody += '='.repeat(50) + '\n\n';

  if (overdue.length > 0) {
    emailBody += `⚠️ OVERDUE PROJECTS (${overdue.length}):\n`;
    emailBody += '-'.repeat(50) + '\n';
    overdue.forEach(p => {
      emailBody += `• ${p.projectName} (${p.clientName}) - ${p.daysOverdue} days overdue\n`;
    });
    emailBody += '\n';
  }

  if (dueToday.length > 0) {
    emailBody += `🔔 DUE TODAY (${dueToday.length}):\n`;
    emailBody += '-'.repeat(50) + '\n';
    dueToday.forEach(p => {
      emailBody += `• ${p.projectName} (${p.clientName})\n`;
    });
    emailBody += '\n';
  }

  if (upcoming.length > 0) {
    emailBody += `📅 UPCOMING (within 3 days) (${upcoming.length}):\n`;
    emailBody += '-'.repeat(50) + '\n';
    upcoming.forEach(p => {
      emailBody += `• ${p.projectName} (${p.clientName}) - in ${p.daysUntil} days\n`;
    });
    emailBody += '\n';
  }

  emailBody += '\nView full dashboard: ';
  emailBody += `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `📊 Daily Deadline Report - ${Utilities.formatDate(new Date(), TIMEZONE, 'MMM dd, yyyy')}`,
    body: emailBody
  });

  Logger.log('Admin summary email sent');
}

/**
 * Sends reminder emails to clients (optional feature)
 */
function sendClientReminders_(upcoming, dueToday) {
  // Send reminders for projects due today
  dueToday.forEach(project => {
    if (project.clientEmail) {
      try {
        MailApp.sendEmail({
          to: project.clientEmail,
          subject: `⏰ Project Deadline Today: ${project.projectName}`,
          body: `Hi ${project.clientName},\n\nThis is a reminder that your project "${project.projectName}" deadline is TODAY.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards`
        });
      } catch (error) {
        Logger.log(`Failed to send email to ${project.clientEmail}: ${error.message}`);
      }
    }
  });

  // Send reminders for upcoming deadlines (1 day before)
  upcoming.filter(p => p.daysUntil === 1).forEach(project => {
    if (project.clientEmail) {
      try {
        MailApp.sendEmail({
          to: project.clientEmail,
          subject: `📅 Reminder: Project Deadline Tomorrow - ${project.projectName}`,
          body: `Hi ${project.clientName},\n\nThis is a friendly reminder that your project "${project.projectName}" deadline is TOMORROW.\n\nPlease ensure everything is on track.\n\nBest regards`
        });
      } catch (error) {
        Logger.log(`Failed to send email to ${project.clientEmail}: ${error.message}`);
      }
    }
  });
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Run this once to install the daily trigger for automated follow-ups
 * The trigger will run every day at 8 AM
 */
function installDailyTrigger() {
  // Delete existing triggers for dailyDeadlineCheck to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyDeadlineCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new daily trigger at 8 AM
  ScriptApp.newTrigger('dailyDeadlineCheck')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();

  Logger.log('Daily trigger installed! Will run every day at 8 AM');
}

/**
 * Run this to remove the daily trigger
 */
function uninstallDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'dailyDeadlineCheck') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  Logger.log(`Removed ${deletedCount} daily trigger(s)`);
}