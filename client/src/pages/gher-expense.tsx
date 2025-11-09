import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function GherExpense() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    amount: "",
    details: "",
    tagId: "",
    partnerId: "",
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["/api/gher/entries"],
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/gher/tags"],
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["/api/gher/partners"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
      toast({ title: "Entry created successfully" });
      handleCloseDialog();
    },
    onError: () => toast({ title: "Failed to create entry", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/gher/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
      toast({ title: "Entry updated successfully" });
      handleCloseDialog();
    },
    onError: () => toast({ title: "Failed to update entry", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gher/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
      toast({ title: "Entry deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      amount: "",
      details: "",
      tagId: "",
      partnerId: "",
    });
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setFormData({
      date: format(new Date(entry.date), "yyyy-MM-dd"),
      type: entry.type,
      amount: entry.amount,
      details: entry.details || "",
      tagId: entry.tagId || "",
      partnerId: entry.partnerId || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      date: new Date(formData.date),
      amount: parseFloat(formData.amount),
      tagId: formData.tagId || null,
      partnerId: formData.partnerId || null,
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getTagName = (tagId: string) => tags.find((t: any) => t.id === tagId)?.name || "-";
  const getPartnerName = (partnerId: string) => partners.find((p: any) => p.id === partnerId)?.name || "-";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expense Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()} data-testid="button-add-entry">
              Add New Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEntry ? "Edit Entry" : "Add New Entry"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="input-entry-date"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="select-entry-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (BDT)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  data-testid="input-entry-amount"
                />
              </div>
              <div>
                <Label>Partner</Label>
                <Select value={formData.partnerId || "none"} onValueChange={(value) => setFormData({ ...formData, partnerId: value === "none" ? "" : value })}>
                  <SelectTrigger data-testid="select-entry-partner">
                    <SelectValue placeholder="Select partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {partners.map((partner: any) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tag</Label>
                <Select value={formData.tagId || "none"} onValueChange={(value) => setFormData({ ...formData, tagId: value === "none" ? "" : value })}>
                  <SelectTrigger data-testid="select-entry-tag">
                    <SelectValue placeholder="Select tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tags.map((tag: any) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Details</Label>
                <Textarea
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  data-testid="input-entry-details"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-entry">
                  {editingEntry ? "Update" : "Create"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry: any) => (
                  <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                    <TableCell>{format(new Date(entry.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          entry.type === "income"
                            ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {entry.type}
                      </span>
                    </TableCell>
                    <TableCell>৳{parseFloat(entry.amount).toLocaleString()}</TableCell>
                    <TableCell>{getPartnerName(entry.partnerId)}</TableCell>
                    <TableCell>{getTagName(entry.tagId)}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.details || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(entry)} data-testid={`button-edit-${entry.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(entry.id)}
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
