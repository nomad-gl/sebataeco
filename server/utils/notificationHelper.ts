import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export type NotificationType = "profile_update" | "subject_assignment" | "schedule_change" | "assignment_history" | "general";

/**
 * Create in-app notification for a teacher
 */
export async function createNotification(
  teacherId: number,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Import schema dynamically to avoid circular dependencies
    const { teacher_notifications } = await import("../../drizzle/schema");
    
    await db.insert(teacher_notifications).values({
      teacher_id: teacherId,
      notification_type: type,
      title,
      message,
      related_id: relatedId || null,
      is_read: false,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error };
  }
}

/**
 * Create bulk in-app notifications for multiple teachers
 */
export async function createBulkNotifications(
  teacherIds: number[],
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: number
) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { teacher_notifications } = await import("../../drizzle/schema");
    
    const values = teacherIds.map((teacherId) => ({
      teacher_id: teacherId,
      notification_type: type,
      title,
      message,
      related_id: relatedId || null,
      is_read: false,
    }));

    await db.insert(teacher_notifications).values(values);

    return { success: true };
  } catch (error) {
    console.error("Failed to create bulk notifications:", error);
    return { success: false, error };
  }
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

/**
 * Email notification helper - placeholder for future SMTP integration
 * Currently returns success to avoid breaking the notification system
 */
export async function sendEmailNotification(
  teacherId: number,
  notificationType: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
) {
  try {
    console.warn(`[Email] Email notifications not yet configured. Notification: ${title}`);
    // In production, implement SMTP integration here
    return { sent: false, smtpNotConfigured: true };
  } catch (error) {
    console.error("Failed to send email notification:", error);
    return { sent: false, smtpNotConfigured: false, error };
  }
}

/**
 * Bulk email notification helper - placeholder for future SMTP integration
 */
export async function sendBulkEmailNotifications(
  teacherIds: number[],
  notificationType: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
) {
  try {
    console.warn(`[Email] Bulk email notifications not yet configured`);
    // In production, implement bulk SMTP integration here
    return { success: false, error: "Email not configured" };
  } catch (error) {
    console.error("Failed to send bulk email notification:", error);
    return { success: false, error };
  }
}

/**
 * SMS notification helper - placeholder for future Twilio integration
 */
export async function sendSmsToTeacher(
  teacherId: number,
  message: string
) {
  try {
    console.warn(`[SMS] SMS notifications not yet configured for teacher ${teacherId}`);
    // In production, implement Twilio integration here
    return { sent: false, twilioNotConfigured: true, error: "SMS not configured" };
  } catch (error) {
    console.error("Failed to send SMS notification:", error);
    return { sent: false, twilioNotConfigured: false, error };
  }
}

/**
 * Bulk SMS notification helper - placeholder for future Twilio integration
 */
export async function sendBulkSmsToTeachers(
  teacherIds: number[],
  message: string
) {
  try {
    console.warn(`[SMS] Bulk SMS notifications not yet configured`);
    // In production, implement bulk Twilio integration here
    return { success: false, error: "SMS not configured" };
  } catch (error) {
    console.error("Failed to send bulk SMS notification:", error);
    return { success: false, error };
  }
}
