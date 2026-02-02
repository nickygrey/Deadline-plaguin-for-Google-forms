# Deadline Manager — Google Apps Script

Automated deadline tracking system that connects Google Forms, Google Calendar, and Google Sheets. When a client submits a form, the script creates a calendar event, logs it to a dashboard, and sends daily email reminders for upcoming and overdue deadlines.

## Features

- **Form-to-Calendar** — Automatically creates all-day calendar events from Google Form submissions
- **Spreadsheet Dashboard** — Logs all deadlines with status tracking (Pending, In Progress, Completed, Overdue) and color coding
- **Daily Email Reports** — Sends admin a summary of overdue, due today, and upcoming deadlines
- **Client Reminders** — Emails clients when their deadline is tomorrow or today
- **Business Days Calculation** — Skips weekends when computing deadlines from packages
- **Package-Based Deadlines** — Express (2 days), Standard (5 days), Premium (10 days), or custom day count

## Setup

### 1. Create a Google Form

Create a form with these questions (titles must match exactly):

| Question Title     | Type              |
|--------------------|-------------------|
| Name and Surname   | Short answer      |
| Project Name       | Short answer      |
| Email              | Short answer      |
| Package            | Multiple choice (Express / Standard / Premium) |
| Deadline in days   | Short answer (optional, overrides package) |

### 2. Create a Google Sheet

Create a new spreadsheet and copy its ID from the URL:

```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

### 3. Add the Script

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Paste the contents of `deadline.gs`
3. Update the configuration at the top of the file:

```javascript
const CALENDAR_ID = 'your-email@gmail.com';
const SPREADSHEET_ID = 'your-spreadsheet-id';
const ADMIN_EMAIL = 'your-email@gmail.com';
```

4. If your form questions have different titles, update `FORM_FIELDS` to match.

### 4. Initialize

Run these functions once from the Apps Script editor (Run > select function):

1. **`setupDashboard()`** — Creates the dashboard sheet with headers, formatting, and status validation
2. **`installDailyTrigger()`** — Sets up an automated daily check at 8 AM

### 5. Connect the Form Trigger

1. In the Apps Script editor, go to **Triggers** (clock icon in sidebar)
2. Click **Add Trigger**
3. Set:
   - Function: `onFormSubmit`
   - Event source: From form
   - Event type: On form submit
4. Authorize the required permissions

## Dashboard Columns

| Column       | Description                        |
|--------------|------------------------------------|
| Created Date | When the form was submitted        |
| Client Name  | Client's name from the form        |
| Project Name | Project name from the form         |
| Email        | Client's email                     |
| Package      | Selected package tier              |
| Days         | Custom deadline days (if provided) |
| Deadline     | Computed deadline date             |
| Status       | Pending / In Progress / Completed / Overdue |
| Last Updated | Last time the status was changed   |
| Event ID     | Google Calendar event reference    |

## How Deadlines Are Calculated

1. If the client provides a number in "Deadline in days", that number of **calendar days** is added to the submission date
2. If no number is provided, the selected **package** determines the deadline in **business days** (weekends excluded):
   - Express: 2 business days
   - Standard: 5 business days
   - Premium: 10 business days

## Available Functions

| Function                    | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `onFormSubmit(e)`           | Handles form submissions (triggered automatically) |
| `setupDashboard()`         | Creates the spreadsheet dashboard (run once)  |
| `installDailyTrigger()`    | Enables daily automated checks (run once)     |
| `uninstallDailyTrigger()`  | Removes the daily trigger                     |
| `dailyDeadlineCheck()`     | Runs status updates and sends emails          |
| `updateProjectStatuses()`  | Marks overdue projects in the sheet           |
| `sendFollowUpEmails()`     | Sends admin summary and client reminders      |

## Tech Stack

- Google Apps Script
- Google Forms API
- Google Calendar API
- Google Sheets API
- MailApp (Gmail)
