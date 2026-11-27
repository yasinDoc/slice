// "Your report made a difference": closing the loop with the people who report.
// Staff keep reporting when they see reports lead to change. Pure; no names, ever.

/**
 * @param {object} p
 * @param {string} p.fixText       the system fix that was completed
 * @param {string} p.actionKey     Jira key of the completed action item
 * @param {string} [p.signalTitle] the pattern the reports belonged to, if any
 * @param {number} [p.reportCount] how many reports were in that pattern
 */
export function thankYouMessage({ fixText, actionKey, signalTitle, reportCount }) {
  const others = Math.max(0, (reportCount || 1) - 1);
  const pattern = signalTitle
    ? `This report${others ? ` and ${others} other${others === 1 ? '' : 's'}` : ''} in the pattern "${signalTitle}"`
    : 'This report';
  return [
    '🙏 Your report made a difference.',
    `${pattern} led to a system fix that is now done: ${fixText} (${actionKey}).`,
    '',
    'Thank you for reporting. Near-miss reports are how we find the holes before they line up.',
    'Slice never names or ranks individuals; this note goes to every report in the pattern.',
  ].join('\n');
}

/** Status category "done" in Jira. */
export const isDone = (issue) => issue?.fields?.status?.statusCategory?.key === 'done';
