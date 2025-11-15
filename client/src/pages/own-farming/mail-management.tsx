import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Mail, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EmailAccount = {
  id: string;
  email: string;
  password: string;
  provider?: string;
  notes?: string;
  createdAt: string;
};

export default function MailManagementPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    provider: "",
    notes: "",
  });

  const { data: emailAccounts, isLoading } = useQuery<EmailAccount[]>({
    queryKey: ["/api/email-accounts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/email-accounts", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({ title: "Email account added successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to add email account", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest(`/api/email-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({ title: "Email account updated successfully" });
      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update email account", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/email-accounts/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({ title: "Email account deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete email account", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ email: "", password: "", provider: "", notes: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (account: EmailAccount) => {
    setEditingAccount(account);
    setFormData({
      email: account.email,
      password: account.password,
      provider: account.provider || "",
      notes: account.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this email account?")) {
      deleteMutation.mutate(id);
    }
  };

  const togglePasswordVisibility = (accountId: string) => {
    setShowPassword(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Mail Management</h1>
          <p className="text-muted-foreground mt-2">Manage and track your email accounts</p>
        </div>
        <Button 
          onClick={() => {
            setEditingAccount(null);
            resetForm();
            setIsDialogOpen(true);
          }}
          data-testid="button-add-email"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Email Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-email-accounts">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Password</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Notes</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {emailAccounts && emailAccounts.length > 0 ? (
                  emailAccounts.map((account) => (
                    <tr key={account.id} className="border-b hover-elevate" data-testid={`row-email-${account.id}`}>
                      <td className="p-3 font-medium">{account.email}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {showPassword[account.id] ? account.password : "••••••••"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => togglePasswordVisibility(account.id)}
                            data-testid={`button-toggle-password-${account.id}`}
                          >
                            {showPassword[account.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{account.provider || "N/A"}</td>
                      <td className="p-3 text-muted-foreground">{account.notes || "N/A"}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(account)}
                            data-testid={`button-edit-${account.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(account.id)}
                            data-testid={`button-delete-${account.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No email accounts found. Add your first email account to start tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-email-form">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Email Account" : "Add Email Account"}</DialogTitle>
            <DialogDescription>
              {editingAccount ? "Update the email account details below." : "Add a new email account to track."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  data-testid="input-password"
                />
              </div>
              <div>
                <Label htmlFor="provider">Provider (e.g., Gmail, Outlook)</Label>
                <Input
                  id="provider"
                  type="text"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  data-testid="input-provider"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingAccount(null);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {editingAccount ? "Update" : "Add"} Email Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
