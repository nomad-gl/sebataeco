import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface TeacherProfileEditFormProps {
  initialData?: {
    name?: string;
    email?: string;
    phone?: string;
    bio?: string;
    preferredLanguage?: string;
    officeLocation?: string;
  };
  onSave?: () => void;
  onCancel?: () => void;
}

export default function TeacherProfileEditForm({
  initialData,
  onSave,
  onCancel,
}: TeacherProfileEditFormProps) {
  const [formData, setFormData] = useState({
    displayName: initialData?.name || "",
    phone: initialData?.phone || "",
    bio: initialData?.bio || "",
    preferredLanguage: initialData?.preferredLanguage || "en",
    officeLocation: initialData?.officeLocation || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const updateProfileMutation = trpc.teacherProfile.updateTeacherProfile.useMutation();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required";
    } else if (formData.displayName.length > 128) {
      newErrors.displayName = "Display name must be less than 128 characters";
    }

    if (formData.phone && formData.phone.length > 20) {
      newErrors.phone = "Phone number must be less than 20 characters";
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = "Bio must be less than 500 characters";
    }

    if (formData.officeLocation && formData.officeLocation.length > 255) {
      newErrors.officeLocation = "Office location must be less than 255 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        displayName: formData.displayName,
        phone: formData.phone || undefined,
        bio: formData.bio || undefined,
        preferredLanguage: formData.preferredLanguage as "en" | "es" | "ca",
        officeLocation: formData.officeLocation || undefined,
      });

      toast.success("Profile updated successfully!");
      onSave?.();
    } catch (error) {
      toast.error(`Failed to update profile: ${(error as Error).message}`);
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Edit Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-slate-300">
              Display Name *
            </Label>
            <Input
              id="displayName"
              type="text"
              value={formData.displayName}
              onChange={(e) => {
                setFormData({ ...formData, displayName: e.target.value });
                if (errors.displayName) {
                  setErrors({ ...errors, displayName: "" });
                }
              }}
              placeholder="Your full name"
              className="bg-slate-700 border-slate-600 text-white"
              maxLength={128}
            />
            {errors.displayName && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.displayName}
              </p>
            )}
            <p className="text-slate-500 text-xs">
              {formData.displayName.length}/128 characters
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={initialData?.email || ""}
              disabled
              className="bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed"
            />
            <p className="text-slate-500 text-xs">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-300">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) {
                  setErrors({ ...errors, phone: "" });
                }
              }}
              placeholder="+1 (555) 000-0000"
              className="bg-slate-700 border-slate-600 text-white"
              maxLength={20}
            />
            {errors.phone && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.phone}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="text-slate-300">
              Bio / About
            </Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => {
                setFormData({ ...formData, bio: e.target.value });
                if (errors.bio) {
                  setErrors({ ...errors, bio: "" });
                }
              }}
              placeholder="Tell us about yourself..."
              className="bg-slate-700 border-slate-600 text-white min-h-24"
              maxLength={500}
            />
            {errors.bio && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.bio}
              </p>
            )}
            <p className="text-slate-500 text-xs">
              {formData.bio.length}/500 characters
            </p>
          </div>

          {/* Preferred Language */}
          <div className="space-y-2">
            <Label htmlFor="language" className="text-slate-300">
              Preferred Language
            </Label>
            <Select value={formData.preferredLanguage} onValueChange={(value) => {
              setFormData({ ...formData, preferredLanguage: value });
            }}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="ca">Català</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Office Location */}
          <div className="space-y-2">
            <Label htmlFor="officeLocation" className="text-slate-300">
              Office Location
            </Label>
            <Input
              id="officeLocation"
              type="text"
              value={formData.officeLocation}
              onChange={(e) => {
                setFormData({ ...formData, officeLocation: e.target.value });
                if (errors.officeLocation) {
                  setErrors({ ...errors, officeLocation: "" });
                }
              }}
              placeholder="e.g., Building A, Room 201"
              className="bg-slate-700 border-slate-600 text-white"
              maxLength={255}
            />
            {errors.officeLocation && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.officeLocation}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              {updateProfileMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Save Changes
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              disabled={updateProfileMutation.isPending}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
