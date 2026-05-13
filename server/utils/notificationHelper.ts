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
