/**
 * Notification Helper - Stub functions
 * Full implementation pending database schema alignment
 */

export type NotificationType = "profile_update" | "subject_assignment" | "schedule_change" | "assignment_history" | "general";

export async function createNotification(
  teacherId: number,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  console.log(`[Notification] ${type}: ${title} - ${message}`);
  return { success: true };
}

export async function createBulkNotifications(
  teacherIds: number[],
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  console.log(`[Bulk Notification] ${type}: ${title} to ${teacherIds.length} teachers`);
  return { success: true };
}

export async function notifyTeacherProfileUpdate(teacherId: number, updatedFields: string[]) {
  return createNotification(
    teacherId,
    "profile_update",
    "Your profile has been updated",
    `The following fields were updated: ${updatedFields.join(", ")}`
  );
}

export async function notifySubjectAssignment(
  teacherId: number,
  subjectName: string,
  classroom: string,
  semester: string
) {
  return createNotification(
    teacherId,
    "subject_assignment",
    "New subject assignment",
    `You have been assigned to teach ${subjectName} in ${classroom} for ${semester}`
  );
}

export async function notifyScheduleChange(teacherId: number, changeDetails: string) {
  return createNotification(
    teacherId,
    "schedule_change",
    "Your schedule has changed",
    changeDetails
  );
}

export async function notifyAssignmentHistory(teacherId: number, action: string, details: string) {
  return createNotification(
    teacherId,
    "assignment_history",
    `Assignment ${action}`,
    details
  );
}

export async function sendEmailNotification() {
  console.warn("sendEmailNotification is disabled - pending SMTP configuration");
  return { sent: false, smtpNotConfigured: true };
}

export async function sendBulkEmailNotifications() {
  console.warn("sendBulkEmailNotifications is disabled - pending SMTP configuration");
  return { success: false };
}

export async function sendSmsToTeacher() {
  console.warn("sendSmsToTeacher is disabled - pending Twilio configuration");
  return { sent: false, twilioNotConfigured: true };
}

export async function sendBulkSmsToTeachers() {
  console.warn("sendBulkSmsToTeachers is disabled - pending Twilio configuration");
  return { success: false };
}
