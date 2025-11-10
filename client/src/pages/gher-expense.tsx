import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Download, Upload, FileDown } from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/Sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function GherExpense() {
  const { toast } = useToast();
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    amount: "",
    details: "",
    tagId: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ["/api/gher/entries"],
  });

  const { data: tags = [] } = useQuery<any[]>({
    queryKey: ["/api/gher/tags"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
      toast({ title: "Entry created successfully" });
      resetForm();
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
      resetForm();
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

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/gher/entries/delete-all");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
      toast({ title: "Success", description: data.message || "All entries deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete all entries", variant: "destructive" }),
  });

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      amount: "",
      details: "",
      tagId: "",
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
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      date: new Date(formData.date),
      amount: parseFloat(formData.amount),
      tagId: formData.tagId || null,
      partnerId: null,
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleExportCSV = () => {
    const csvHeaders = "Date,Details,Type,Amount (BDT),Tag\n";
    const csvRows = entries.map((entry: any) => {
      const date = format(new Date(entry.date), "MM/dd/yyyy");
      const details = (entry.details || "").replace(/,/g, ";");
      const type = entry.type;
      const amount = parseFloat(entry.amount);
      const tag = getTagName(entry.tagId);
      return `${date},${details},${type},${amount},${tag}`;
    }).join("\n");

    const csvContent = csvHeaders + csvRows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gher-entries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast({ title: "Entries exported successfully" });
  };

  const handleDownloadExample = () => {
    const exampleCSV = `Date,Details,Type,Amount (BDT),Tag
11/09/2025,Fish Feed Purchase,expense,5000,Feed
11/08/2025,Fish Sale,income,15000,Sale
11/07/2025,Electricity Bill,expense,800,Utilities`;
    
    const blob = new Blob([exampleCSV], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "gher-entries-example.csv";
    link.click();
    toast({ title: "Example CSV downloaded" });
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({ title: "Empty CSV file", variant: "destructive" });
          return;
        }

        const header = lines[0].toLowerCase();
        if (!header.includes("date") || !header.includes("type") || !header.includes("amount")) {
          toast({ title: "Invalid CSV format. Please use the example format.", variant: "destructive" });
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(",").map(v => v.trim());
          if (values.length < 4) {
            errors.push(`Row ${i + 1}: Not enough columns`);
            errorCount++;
            continue;
          }

          const [dateStr, details, type, amountStr, tagName] = values;

          try {
            const dateParts = dateStr.split("/");
            let entryDate: Date;
            
            if (dateParts.length === 3) {
              const [month, day, year] = dateParts;
              entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              entryDate = new Date(dateStr);
            }

            if (isNaN(entryDate.getTime())) {
              errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
              errorCount++;
              continue;
            }

            const amount = parseFloat(amountStr);
            if (isNaN(amount)) {
              errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
              errorCount++;
              continue;
            }

            const entryType = type.toLowerCase().trim();
            if (entryType !== "income" && entryType !== "expense") {
              errors.push(`Row ${i + 1}: Invalid type "${type}" (must be "income" or "expense")`);
              errorCount++;
              continue;
            }

            const tag = tags.find((t: any) => t.name.toLowerCase() === tagName?.toLowerCase());
            
            if (tagName && !tag) {
              errors.push(`Row ${i + 1}: Tag "${tagName}" not found. Create it in Settings first.`);
            }

            const entryData = {
              date: entryDate,
              type: entryType,
              amount,
              details: details || "",
              tagId: tag?.id || null,
              partnerId: null,
            };

            await apiRequest("POST", "/api/gher/entries", entryData);
            successCount++;
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
            errorCount++;
          }
        }

        queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
        queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });

        if (successCount > 0) {
          const warningMessages = errors.filter(e => e.includes("Tag") && e.includes("not found"));
          const errorMessages = errors.filter(e => !warningMessages.includes(e));
          
          if (warningMessages.length > 0) {
            console.warn("Tag warnings:", warningMessages);
            toast({ 
              title: `Imported ${successCount} entries (${warningMessages.length} without tags)`,
              description: `${warningMessages.length} entries missing tags. Create tags in Settings first.`,
              variant: "default"
            });
          } else if (errorCount > 0) {
            toast({ title: `Imported ${successCount} entries successfully (${errorCount} failed)` });
          } else {
            toast({ title: `Imported ${successCount} entries successfully` });
          }
        } else {
          console.error("Import errors:", errors);
          toast({ 
            title: "Failed to import entries", 
            description: errors.length > 0 ? errors[0] : "Please check the CSV format",
            variant: "destructive" 
          });
        }
      } catch (error) {
        console.error("CSV import error:", error);
        toast({ 
          title: "Error reading CSV file", 
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive" 
        });
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getTagName = (tagId: string) => tags.find((t: any) => t.id === tagId)?.name || "-";

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl font-semibold">Expense Management</h1>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleDownloadExample} data-testid="button-download-example">
                <FileDown className="w-4 h-4 mr-2" />
                Example CSV
              </Button>
              <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import-csv">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
                data-testid="input-csv-file"
              />
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-all">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all {entries?.length || 0} entry(ies) from the database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAllMutation.mutate()}
                      disabled={deleteAllMutation.isPending}
                      data-testid="button-confirm-delete-all"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{editingEntry ? "Edit Entry" : "Add New Entry"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      data-testid="input-entry-date"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger id="type" data-testid="select-entry-type">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (BDT)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    data-testid="input-entry-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details">Details</Label>
                  <Textarea
                    id="details"
                    placeholder="Enter expense/income details"
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    data-testid="input-entry-details"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tag">Tag</Label>
                  <Select value={formData.tagId || "none"} onValueChange={(value) => setFormData({ ...formData, tagId: value === "none" ? "" : value })}>
                    <SelectTrigger id="tag" data-testid="select-entry-tag">
                      <SelectValue placeholder="Select Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select Tag</SelectItem>
                      {tags.map((tag: any) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Select from admin-defined tags</p>
                </div>

                <div className="flex justify-end gap-2">
                  {editingEntry && (
                    <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel">
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-entry">
                    {editingEntry ? "Update Entry" : "Save Entry"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

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
                    <TableHead>Tag</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
      </div>
    </Sidebar>
  );
}
