/**
 * AdminSchoolManagement — Manage schools and school-teacher relationships
 * Admin-only dashboard for creating, editing, and deleting schools
 */

import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../lib/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/use-toast";
import { Loader2, Plus, Edit2, Trash2, X } from "lucide-react";

type School = {
  id: number;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  headmaster?: string;
  notes?: string;
};

type FormData = Omit<School, "id">;

export function AdminSchoolManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    code: "",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    headmaster: "",
    notes: "",
  });

  // Queries
  const { data: schools, isLoading, refetch } = trpc.schools.list.useQuery();

  // Mutations
  const createMutation = trpc.schools.create.useMutation({
    onSuccess: () => {
      toast({ title: "School created successfully" });
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.schools.update.useMutation({
    onSuccess: () => {
      toast({ title: "School updated successfully" });
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.schools.delete.useMutation({
    onSuccess: () => {
      toast({ title: "School deleted successfully" });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Check admin access
  if (user?.role !== "admin") {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">Access denied. Admin only.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "School name is required", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (school: School) => {
    setFormData(school);
    setEditingId(school.id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this school?")) {
      deleteMutation.mutate({ id });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      city: "",
      postalCode: "",
      phone: "",
      email: "",
      headmaster: "",
      notes: "",
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">School Management</h1>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="gap-2"
        >
          <Plus size={20} />
          Add School
        </Button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit School" : "Create New School"}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="School Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Escola Primària"
                required
              />
              <Input
                label="School Code"
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., ESP001"
              />
              <Input
                label="City"
                value={formData.city || ""}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Barcelona"
              />
              <Input
                label="Postal Code"
                value={formData.postalCode || ""}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="e.g., 08002"
              />
              <Input
                label="Phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g., +34 93 123 4567"
              />
              <Input
                label="Email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g., info@escola.cat"
              />
              <Input
                label="Headmaster/Principal"
                value={formData.headmaster || ""}
                onChange={(e) => setFormData({ ...formData, headmaster: e.target.value })}
                placeholder="e.g., Joan Martínez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Address</label>
              <textarea
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g., Carrer de la Pau, 123"
                className="w-full p-2 border rounded"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about the school"
                className="w-full p-2 border rounded"
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? "Update School" : "Create School"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Schools List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Schools</h2>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !schools || schools.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            No schools found. Create one to get started.
          </Card>
        ) : (
          <div className="grid gap-4">
            {schools.map((school) => (
              <Card key={school.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{school.name}</h3>
                    {school.code && <p className="text-sm text-gray-600">Code: {school.code}</p>}
                    {school.city && <p className="text-sm text-gray-600">City: {school.city}</p>}
                    {school.email && <p className="text-sm text-gray-600">Email: {school.email}</p>}
                    {school.phone && <p className="text-sm text-gray-600">Phone: {school.phone}</p>}
                    {school.headmaster && (
                      <p className="text-sm text-gray-600">Headmaster: {school.headmaster}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(school)}
                      className="gap-1"
                    >
                      <Edit2 size={16} />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(school.id)}
                      className="gap-1"
                    >
                      <Trash2 size={16} />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
