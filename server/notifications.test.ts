import { describe, it, expect } from "vitest";
import {
  createNotification,
  createBulkNotifications,
  notifyTeacherProfileUpdate,
  notifySubjectAssignment,
  notifyScheduleChange,
  notifyAssignmentHistory,
} from "./utils/notificationHelper";

describe("Notification Delivery System", () => {
  describe("In-app Notifications", () => {
    it("should create a single notification", async () => {
      const result = await createNotification(
        1,
        "general",
        "Test Notification",
        "This is a test notification"
      );
      expect(result.success).toBe(true);
    });

    it("should create bulk notifications", async () => {
      const result = await createBulkNotifications(
        [1, 2, 3],
        "general",
        "Bulk Test",
        "This is a bulk notification"
      );
      expect(result.success).toBe(true);
    });

    it("should notify teacher of profile update", async () => {
      const result = await notifyTeacherProfileUpdate(1, ["email", "phone"]);
      expect(result.success).toBe(true);
    });

    it("should notify teacher of subject assignment", async () => {
      const result = await notifySubjectAssignment(
        1,
        "Mathematics",
        "Class A",
        "Semester 1"
      );
      expect(result.success).toBe(true);
    });

    it("should notify teacher of schedule change", async () => {
      const result = await notifyScheduleChange(
        1,
        "Your schedule has been updated for next week"
      );
      expect(result.success).toBe(true);
    });

    it("should notify teacher of assignment history", async () => {
      const result = await notifyAssignmentHistory(
        1,
        "imported",
        "5 new assignments were imported"
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Notification Types", () => {
    it("should support profile_update notification type", async () => {
      const result = await createNotification(
        1,
        "profile_update",
        "Profile Updated",
        "Your profile has been updated"
      );
      expect(result.success).toBe(true);
    });

    it("should support subject_assignment notification type", async () => {
      const result = await createNotification(
        1,
        "subject_assignment",
        "New Assignment",
        "You have been assigned to teach a new subject"
      );
      expect(result.success).toBe(true);
    });

    it("should support schedule_change notification type", async () => {
      const result = await createNotification(
        1,
        "schedule_change",
        "Schedule Changed",
        "Your schedule has been updated"
      );
      expect(result.success).toBe(true);
    });

    it("should support assignment_history notification type", async () => {
      const result = await createNotification(
        1,
        "assignment_history",
        "Assignment History",
        "Your assignment history has been updated"
      );
      expect(result.success).toBe(true);
    });

    it("should support general notification type", async () => {
      const result = await createNotification(
        1,
        "general",
        "General Notification",
        "This is a general notification"
      );
      expect(result.success).toBe(true);
    });
  });
});
