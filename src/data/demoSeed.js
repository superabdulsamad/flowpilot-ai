// Fictional sample data used to seed a brand-new workspace (mock or real Firestore).
// None of the names, tasks, vendors, or figures below are real — this file exists so
// the app has something meaningful to show on first run.

export const DEMO_ADMIN = {
  username: 'demo',
  password: 'demo1234',
  displayName: 'Demo Admin',
};

export const DEFAULT_MEMBERS = {
  Alex: { color: '#4f46e5', bg: 'rgba(79,70,229,.12)' },
  Jordan: { color: '#0d9488', bg: 'rgba(13,148,136,.1)' },
  Priya: { color: '#16a34a', bg: 'rgba(22,163,74,.1)' },
  Sam: { color: '#7c3aed', bg: 'rgba(124,58,237,.1)' },
  Marco: { color: '#0891b2', bg: 'rgba(8,145,178,.1)' },
  Riya: { color: '#d946ef', bg: 'rgba(217,70,239,.1)' },
};

export const MEMBER_COLORS = [
  '#4f46e5', '#0d9488', '#16a34a', '#dc2626', '#7c3aed', '#0891b2',
  '#d946ef', '#ea580c', '#2563eb', '#b45309', '#c026d3', '#65a30d',
];

export const DEMO_COURSE_NAME = 'Cloud Data Engineering';

// Generic course-launch checklist template, fictionalized: same section shape as the
// original (pre-launch / sales / masterclass / one-on-one / batch) but generic content.
export function generateDemoTemplate(courseName) {
  function t(id, n, s, sub, a, r) {
    return { id, name: n, due: '', assignee: a || '', reviewer: r || '', status: 'Pending', section: s, sub: sub || false, priority: '', notes: '', blockedBy: '' };
  }
  return [
    t('PL-01', 'Finalise instructor for ' + courseName, 'pre-launch', 0, 'Priya', 'Alex'),
    t('PL-02', 'Finalise course curriculum', 'pre-launch', 0, 'Priya', 'Alex'),
    t('PL-03', 'Attach syllabus on landing page', 'pre-launch', 0, 'Sam', 'Alex'),
    t('PL-04', 'Build signup funnel for ' + courseName, 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-05', 'Align blog/newsletter: ' + courseName, 'pre-launch', 0, 'Sam', 'Priya'),
    t('PL-06', 'Create lead-magnet ebook funnel', 'pre-launch', 0, '', 'Jordan'),
    t('PL-07', 'Design PDF learning paths', 'pre-launch', 0, 'Priya', 'Priya'),
    t('PL-08', 'Manage social calendar', 'pre-launch', 0, 'Sam', 'Alex'),
    t('PL-09', 'Masterclass topics + slide deck', 'pre-launch', 0, 'Priya', 'Priya'),
    t('PL-10', 'Prepare social media posts', 'pre-launch', 0, 'Sam', 'Alex'),
    t('PL-11', 'Email templates for review', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-12', 'Upload trailer video + SEO', 'pre-launch', 0, 'Jordan', 'Priya'),
    t('PL-12a', 'Email: course launch', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12b', 'Email: learning path PDF', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12c', 'Email: masterclass launch', 'pre-launch', 1, 'Jordan', 'Jordan'),
    t('PL-12d', 'Email: reminder 1 day', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12e', 'Email: reminder 4hr', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12f', 'Email: reminder 1hr', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12g', 'Email: reminder 15min', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-12h', 'Email: masterclass started — join', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-13', 'Broadcast masterclass reminder', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-13a', 'Broadcast: masterclass launch', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-13b', 'Broadcast: reminder 1 day + PDF', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-13c', 'Broadcast: reminder 30min', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-13d', 'Broadcast: reminder 15min', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-14', 'Social calendar ready every Friday', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-15', 'Outreach: send PDF to 30 leads/day', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-15b', 'Outreach: masterclass msg + PDF', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-15c', 'Outreach: strategy call + link', 'pre-launch', 1, 'Jordan', 'Alex'),
    t('PL-16a', 'Tech video: product walkthrough', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-16b', 'Marketing video (Riya)', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-16c', 'Post on all social channels', 'pre-launch', 0, 'Jordan', 'Alex'),
    t('PL-17', 'Join relevant community groups', 'pre-launch', 0, 'Sam, Priya, Jordan', 'Alex'),
    t('PL-18', 'Landing page + automations', 'pre-launch', 0, 'Sam'),
    t('SA-01', 'Syllabus one-pager', 'sales'),
    t('SA-02', 'Career-outcomes infographic', 'sales'),
    t('SA-03', 'Sales video + outcomes data', 'sales'),
    t('MC-01', 'Webinar landing page', 'masterclass'),
    t('MC-02', 'Confirm date/time with instructor', 'masterclass'),
    t('MC-03', 'Finalize slide deck/syllabus', 'masterclass'),
    t('MC-04', 'Create event listing (social)', 'masterclass'),
    t('MC-05', 'Scheduling link', 'masterclass'),
    t('MC-06', 'Feedback form', 'masterclass'),
    t('MC-07a', 'Auto: scheduling reminder', 'masterclass', 1),
    t('MC-07b', 'Auto: broadcast reminder', 'masterclass', 1),
    t('MC-07c', 'Auto: email reminder', 'masterclass', 1),
    t('MC-07d', 'Auto: funnel reminder', 'masterclass', 1),
    t('MC-08', 'Email: recording link', 'masterclass'),
    t('MC-09', 'Urgency email: book 1-on-1', 'masterclass'),
    t('MC-10', 'Upload recording', 'masterclass'),
    t('OO-01', 'Landing page', 'one-on-one'),
    t('OO-02', 'Confirm date/time', 'one-on-one'),
    t('OO-03', 'Event listing (social)', 'one-on-one'),
    t('OO-04', 'Group call link', 'one-on-one'),
    t('OO-05', 'Feedback form', 'one-on-one'),
    t('OO-06', 'Autoresponders', 'one-on-one', 0, 'Sam'),
    t('OO-06a', 'Auto: scheduling', 'one-on-one', 1),
    t('OO-06b', 'Auto: broadcast', 'one-on-one', 1),
    t('OO-06c', 'Auto: email', 'one-on-one', 1),
    t('OO-06d', 'Auto: funnel', 'one-on-one', 1),
    t('OO-07', 'Email: recording', 'one-on-one'),
    t('OO-08', 'Urgency email', 'one-on-one'),
    t('BM-01', 'Create cohort chat group', 'batch', 0, 'Priya'),
    t('BM-02', 'Welcome email + payment', 'batch', 0, 'Priya'),
    t('BM-03', 'Onboarding email', 'batch'),
    t('BM-04', 'LMS access', 'batch', 0, 'Jordan'),
    t('BM-05', 'Payment reminders', 'batch', 0, 'Riya'),
    t('BM-06', 'Upload recordings to LMS', 'batch', 0, 'Jordan', 'Priya'),
    t('BM-07', 'Invoice + finance check', 'batch', 0, 'Priya'),
  ];
}

// Overlay of due dates/status applied to the fictional default course, mirroring the
// "a real course is mid-flight" feel without any real dates or business facts.
export function demoCourseTasks() {
  const tpl = generateDemoTemplate(DEMO_COURSE_NAME);
  const overlay = {
    'PL-01': { due: '2026-03-10', status: 'Done' },
    'PL-02': { due: '2026-03-17', status: 'Done' },
    'PL-03': { due: '2026-03-17', status: 'Done' },
    'PL-04': { due: '2026-03-18', status: 'WIP' },
    'PL-05': { due: '2026-03-23', status: 'WIP' },
    'PL-06': { due: '2026-03-15' },
    'PL-07': { due: '2026-03-16' },
    'PL-08': { due: '2026-03-17', status: 'WIP' },
    'PL-09': { due: '2026-03-18', status: 'WIP' },
    'PL-10': { due: '2026-03-19', status: 'WIP' },
    'PL-11': { due: '2026-03-19' },
    'PL-12': { due: '2026-03-21' },
    'BM-01': { due: '2025-12-31', status: 'Done' },
    'BM-02': { due: '2026-01-01', status: 'Done' },
    'BM-04': { due: '2026-01-04', status: 'Done' },
    'BM-05': { due: '2026-01-05' },
    'BM-06': { status: 'WIP' },
    'OO-06': { status: 'HOLD' },
  };
  tpl.forEach((task) => {
    if (overlay[task.id]) {
      if (overlay[task.id].due) task.due = overlay[task.id].due;
      if (overlay[task.id].status) task.status = overlay[task.id].status;
    }
  });
  return tpl;
}

// Fictional "adhoc tasks" board seed — generic ops tasks, no real vendors or pricing.
export const DEMO_ADHOC_TASKS = [
  { id: 'adhoc_001', name: 'Website landing page refresh', description: 'Refresh hero section and CTA copy', assignee: 'Sam', priority: 'Urgent', endDate: '2026-02-09', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_002', name: 'Fix footer layout on funnel page', description: 'Footer overlaps content on mobile', assignee: 'Sam', priority: 'Urgent', endDate: '2026-02-21', progress: 'In Progress', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_003', name: 'Investigate undelivered broadcast messages', description: 'Some messages failing to send to leads', assignee: 'Jordan', priority: 'Medium', endDate: '2026-02-21', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_004', name: 'Website redesign go-live', description: 'Go live with the new site design', assignee: 'Sam', priority: 'High', endDate: '2026-02-23', progress: 'In Progress', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_005', name: 'Update LinkedIn company page', description: 'Refresh cover image and description', assignee: 'Priya', priority: 'Urgent', endDate: '2026-02-23', progress: 'Completed', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_006', name: 'Enable international payments', description: 'Turn on cross-border payments for checkout', assignee: 'Priya', priority: 'Urgent', endDate: '2026-02-23', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_007', name: 'Upgrade video-call plan', description: 'Evaluate a larger-capacity webinar plan', assignee: 'Priya', priority: 'Medium', endDate: '2026-02-23', progress: 'In Progress', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_008', name: 'Fix email deliverability', description: 'Emails landing in promotions tab', assignee: 'Sam', priority: 'Urgent', endDate: '2026-02-23', progress: 'In Progress', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_009', name: 'Prepare weekly timesheet template', description: 'Standard template for the team', assignee: 'Priya', priority: 'Urgent', endDate: '2026-02-23', progress: 'Completed', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_010', name: 'Disable scheduling auto-pay', description: 'No description', assignee: 'Jordan', priority: 'Urgent', endDate: '2026-02-24', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_011', name: 'Set up company X/Twitter account', description: 'Create and configure a company account', assignee: 'Sam', priority: 'High', endDate: '2026-02-25', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_012', name: 'Create urgency email templates', description: 'Draft 2-3 templates', assignee: 'Jordan', priority: 'Urgent', endDate: '2026-02-25', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_013', name: 'Set up backup social account', description: 'Secondary account for redundancy', assignee: 'Priya', priority: 'Urgent', endDate: '2026-02-26', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_014', name: 'Reactivate suspended account', description: 'Resolve platform account suspension', assignee: 'Priya', priority: 'Urgent', endDate: '2026-02-27', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_015', name: 'Collect top 10 reviews', description: 'Gather reviews across review platforms', assignee: 'Sam', priority: 'Urgent', endDate: '2026-02-27', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_016', name: 'Roll out new logo', description: 'Replace old logo across social profiles', assignee: 'Sam', priority: 'Urgent', endDate: '2026-02-27', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_017', name: 'Shortlist funnel page examples', description: 'Review examples for inspiration', assignee: 'Sam', priority: 'High', endDate: '2026-02-27', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_018', name: 'Technical knowledge-sharing session', description: '30-minute internal session', assignee: 'Priya', priority: 'High', endDate: '2026-02-28', progress: 'In Progress', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_019', name: 'Competitor research', description: 'Research competitor campaigns and ads', assignee: 'Sam', priority: 'Medium', endDate: '2026-03-05', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_020', name: 'SEO/AEO improvement plan', description: 'Plan for search and answer-engine optimization', assignee: 'Sam', priority: 'High', endDate: '2026-03-07', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_021', name: 'Collect video testimonials', description: 'Reach out to past students for reviews', assignee: 'Priya', priority: 'High', endDate: '2026-03-08', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_022', name: 'Plan review-collection session', description: 'Schedule for end of current cohort', assignee: 'Priya', priority: 'High', endDate: '2026-03-08', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_023', name: 'Evaluate community platforms', description: 'Compare community tooling options', assignee: 'Sam', priority: 'High', endDate: '2026-03-09', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_024', name: 'Evaluate post-scheduling tools', description: 'Compare auto-scheduling options', assignee: 'Jordan', priority: 'Urgent', endDate: '2026-03-09', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'adhoc_025', name: 'Draft two new course landing pages', description: 'No description', assignee: 'Sam', priority: 'High', endDate: '2026-03-17', progress: 'Pending', createdAt: '2026-02-01T00:00:00Z' },
];

export const DEMO_COURSE_2 = 'Applied Machine Learning';
