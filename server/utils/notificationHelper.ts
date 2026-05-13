import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

export type NotificationType = "profile_update" | "subject_assignment" | "schedule_change" | "assignment_history" | "general";

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

    await db
      .insertInto("teacher_notifications")
      .values({
        teacher_id: teacherId,
        notification_type: type,
        title,
        message,
        related_id: relatedId || null,
        is_read: false,
      })
      .execute();

    return { success: true };
  } catch (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error };
  }
}

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

    const values = teacherIds.map((teacherId) => ({
      teacher_id: teacherId,
      notification_type: type,
      title,
      message,
      related_id: relatedId || null,
      is_read: false,
    }));

    await db.insertInto("teacher_notifications").values(values).execute();

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

import { sendTeacherNotificationEmail } from "../email";

/**
 * Send email notification to teacher
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
    const db = await getDb();
    if (!db) {
      console.warn("[Email] Database not available");
      return { sent: false, smtpNotConfigured: true };
    }

    // Get teacher email from users table
    const teachers = await db
      .selectFrom("users")
      .select(["email", "displayName", "name"])
      .where("id", "=", teacherId)
      .execute();

    const teacher = teachers[0];

    if (!teacher || !teacher.email) {
      console.warn(`[Notification] Teacher ${teacherId} has no email address`);
      return { sent: false, smtpNotConfigured: false, error: "No email address" };
    }

    const recipientName = teacher.displayName || teacher.name || "Teacher";

    const emailResult = await sendTeacherNotificationEmail({
      to: teacher.email,
      recipientName,
      notificationType,
      title,
      message,
      actionUrl,
      actionLabel,
    });

    return emailResult;
  } catch (error) {
    console.error("Failed to send email notification:", error);
    return { sent: false, smtpNotConfigured: false, error };
  }
}

/**
 * Send email notification to multiple teachers
 */
export async function sendBulkEmailNotifications(
  teacherIds: number[],
  notificationType: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
) {
  const results = await Promise.all(
    teacherIds.map((teacherId) =>
      sendEmailNotification(
        teacherId,
        notificationType,
        title,
        message,
        actionUrl,
        actionLabel
      )
    )
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  return { success: true, successful, failed };
}


import { sendSmsNotification, sendBulkSmsNotifications } from "../sms";

/**
 * Send SMS notification to teacher
 */
export async function sendSmsToTeacher(
  teacherId: number,
  message: string
) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[SMS] Database not available");
      return { sent: false, twilioNotConfigured: true };
    }

    // Get teacher phone from users table
    const teachers = await db
      .selectFrom("users")
      .select(["phone", "displayName", "name"])
      .where("id", "=", teacherId)
      .execute();

    const teacher = teachers[0];

    if (!teacher || !teacher.phone) {
      console.warn(`[SMS] Teacher ${teacherId} has no phone number`);
      return { sent: false, twilioNotConfigured: false, error: "No phone number" };
    }

    const result = await sendSmsNotification({
      to: teacher.phone,
      message,
    });

    return result;
  } catch (error) {
    console.error("Failed to send SMS notification:", error);
    return { sent: false, twilioNotConfigured: false, error };
  }
}

/**
 * Send SMS notification to multiple teachers
 */
export async function sendBulkSmsToTeachers(
  teacherIds: number[],
  message: string
) {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[SMS] Database not available");
      return { success: false, error: "Database not available" };
    }

    // Get teacher phones from users table
    const teachers = await db
      .selectFrom("users")
      .select(["phone"])
      .where("id", "in", teacherIds)
      .execute();

    const phoneNumbers = teachers
      .filter((t) => t.phone)
      .map((t) => t.phone as string);

    if (phoneNumbers.length === 0) {
      console.warn(`[SMS] No phone numbers found for teachers`);
      return { success: false, error: "No phone numbers" };
    }

    const result = await sendBulkSmsNotifications(phoneNumbers, message);
    return result;
  } catch (error) {
    console.error("Failed to send bulk SMS notifications:", error);
    return { success: false, error };
  }
}
