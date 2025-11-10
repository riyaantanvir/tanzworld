import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

export default function GherSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "expense" as "income" | "expense",
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/gher/tags"],
  });

  const { incomeTags, expenseTags } = useMemo(() => {
    const allTags = tags as any[];
    const income = allTags.filter((t: any) => t.type === "income");
    const expense = allTags.filter((t: any) => t.type === "expense");
    return { incomeTags: income, expenseTags: expense };
  }, [tags]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/tags"] });
      toast({ title: "Tag created successfully" });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      console.error("Tag creation error:", error);
      toast({ title: "Failed to create tag", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/gher/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/tags"] });
      toast({ title: "Tag updated successfully" });
      handleCloseDialog();
    },
    onError: () => toast({ title: "Failed to update tag", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gher/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/tags"] });
      toast({ title: "Tag deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete tag", variant: "destructive" }),
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTag(null);
    setFormData({ name: "", type: "expense" });
  };

  const handleOpenDialog = (type: "income" | "expense") => {
    setFormData({ name: "", type });
    setIsDialogOpen(true);
  };

  const handleEdit = (tag: any) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, type: tag.type });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const renderTagSection = (title: string, tagList: any[], type: "income" | "expense") => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        <Button onClick={() => handleOpenDialog(type)} data-testid={`button-add-${type}-tag`}>
          Create Tag
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag Name</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tagList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No {type} tags found
                </TableCell>
              </TableRow>
            ) : (
              tagList.map((tag: any) => (
                <TableRow key={tag.id} data-testid={`row-tag-${tag.id}`}>
                  <TableCell>{tag.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(tag)} data-testid={`button-edit-${tag.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(tag.id)}
                        data-testid={`button-delete-${tag.id}`}
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
  );

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Gher Settings</h1>
          </div>

          {renderTagSection("Income Tags", incomeTags, "income")}
          {renderTagSection("Expense Tags", expenseTags, "expense")}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Tag Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-tag-name"
                  />
                </div>
                <div>
                  <Label>Tag Type</Label>
                  <RadioGroup
                    value={formData.type}
                    onValueChange={(value: "income" | "expense") => setFormData({ ...formData, type: value })}
                    disabled={!!editingTag}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="income" id="income" data-testid="radio-income" />
                      <Label htmlFor="income">Income</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="expense" id="expense" data-testid="radio-expense" />
                      <Label htmlFor="expense">Expense</Label>
                    </div>
                  </RadioGroup>
                  {editingTag && (
                    <p className="text-sm text-muted-foreground mt-1">Tag type cannot be changed after creation</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-tag">
                    {editingTag ? "Update" : "Create"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Sidebar>
  );
}
