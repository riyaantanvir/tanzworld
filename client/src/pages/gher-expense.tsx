import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Download, Upload, FileDown, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/Sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

export default function GherExpense() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "expense",
    amount: "",
    details: "",
    tagId: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import progress state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    successCount: 0,
    errorCount: 0,
    errors: [] as string[],
  });

  // Pagination state - syncs with URL
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(10);

  // Read URL params on mount and location change
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = parseInt(urlParams.get('page') || '1');
    const pageSize = parseInt(urlParams.get('pageSize') || '10');
    setCurrentPage(page);
    setCurrentPageSize(pageSize);
  }, [location]);

  // Update URL when pagination changes
  const updatePagination = (page: number, pageSize: number) => {
    const newParams = new URLSearchParams();
    newParams.set('page', page.toString());
    newParams.set('pageSize', pageSize.toString());
    const basePath = location.split('?')[0];
    setLocation(`${basePath}?${newParams.toString()}`);
  };

  // Fetch paginated entries
  const { data: paginatedData } = useQuery<{
    data: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>({
    queryKey: ["/api/gher/entries", { page: currentPage, pageSize: currentPageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: currentPageSize.toString(),
      });
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/gher/entries?${params}`, {
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch entries");
      return response.json();
    },
  });

  const entries = paginatedData?.data || [];
  const totalEntries = paginatedData?.total || 0;
  const totalPages = paginatedData?.totalPages || 0;

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

  const handleExportCSV = async () => {
    try {
      // Fetch ALL entries for export (not paginated)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '999999', // Very large number to get all entries
      });
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("authToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/gher/entries?${params}`, {
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        toast({ title: "Failed to fetch entries for export", variant: "destructive" });
        return;
      }
      const allEntriesData = await response.json();
      const allEntries = allEntriesData.data || [];

      const csvHeaders = "Date,Details,Type,Amount (BDT),Tag\n";
      const csvRows = allEntries.map((entry: any) => {
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
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Failed to export entries", variant: "destructive" });
    }
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

        const totalRows = lines.length - 1;
        setIsImporting(true);
        setImportProgress({
          current: 0,
          total: totalRows,
          successCount: 0,
          errorCount: 0,
          errors: [],
        });

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        const createdTags = new Map<string, string>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(",").map(v => v.trim());
          if (values.length < 4) {
            const errorMsg = `Row ${i + 1}: Not enough columns`;
            errors.push(errorMsg);
            errorCount++;
            setImportProgress(prev => ({
              ...prev,
              current: i,
              errorCount: errorCount,
              errors: [...prev.errors, errorMsg],
            }));
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
              const errorMsg = `Row ${i + 1}: Invalid date "${dateStr}"`;
              errors.push(errorMsg);
              errorCount++;
              setImportProgress(prev => ({
                ...prev,
                current: i,
                errorCount: errorCount,
                errors: [...prev.errors, errorMsg],
              }));
              continue;
            }

            const amount = parseFloat(amountStr);
            if (isNaN(amount)) {
              const errorMsg = `Row ${i + 1}: Invalid amount "${amountStr}"`;
              errors.push(errorMsg);
              errorCount++;
              setImportProgress(prev => ({
                ...prev,
                current: i,
                errorCount: errorCount,
                errors: [...prev.errors, errorMsg],
              }));
              continue;
            }

            const entryType = type.toLowerCase().trim();
            if (entryType !== "income" && entryType !== "expense") {
              const errorMsg = `Row ${i + 1}: Invalid type "${type}" (must be "income" or "expense")`;
              errors.push(errorMsg);
              errorCount++;
              setImportProgress(prev => ({
                ...prev,
                current: i,
                errorCount: errorCount,
                errors: [...prev.errors, errorMsg],
              }));
              continue;
            }

            let tagId: string | null = null;
            
            if (tagName && tagName.trim() !== "" && tagName !== "-") {
              const normalizedTagName = tagName.trim().substring(0, 100);
              const tagKey = `${entryType}:${normalizedTagName.toLowerCase()}`;
              
              let tag = tags.find((t: any) => 
                t.name.toLowerCase() === normalizedTagName.toLowerCase() && 
                t.type === entryType
              );
              
              if (tag) {
                tagId = tag.id;
              } else if (createdTags.has(tagKey)) {
                tagId = createdTags.get(tagKey)!;
              } else {
                try {
                  const response = await apiRequest("POST", "/api/gher/tags", { 
                    name: normalizedTagName,
                    type: entryType 
                  });
                  const newTag = await response.json();
                  createdTags.set(tagKey, newTag.id);
                  tagId = newTag.id;
                  tags.push(newTag);
                } catch (tagError: any) {
                  const errorMsg = tagError?.message || "Unknown error";
                  if (errorMsg.includes("unique") || errorMsg.includes("duplicate")) {
                    const existingTag = tags.find((t: any) => 
                      t.name.toLowerCase() === normalizedTagName.toLowerCase() && 
                      t.type === entryType
                    );
                    if (existingTag) {
                      tagId = existingTag.id;
                      createdTags.set(tagKey, existingTag.id);
                    }
                  } else {
                    console.error(`Failed to create tag "${normalizedTagName}":`, tagError);
                  }
                }
              }
            }

            const entryData = {
              date: entryDate,
              type: entryType,
              amount,
              details: details || "",
              tagId,
              partnerId: null,
            };

            await apiRequest("POST", "/api/gher/entries", entryData);
            successCount++;
            setImportProgress(prev => ({
              ...prev,
              current: i,
              successCount: successCount,
            }));
          } catch (error) {
            const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            errorCount++;
            setImportProgress(prev => ({
              ...prev,
              current: i,
              errorCount: errorCount,
              errors: [...prev.errors, errorMsg],
            }));
          }
        }

        setIsImporting(false);
        queryClient.invalidateQueries({ queryKey: ["/api/gher/entries"] });
        queryClient.invalidateQueries({ queryKey: ["/api/gher/dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/gher/tags"] });

        if (successCount > 0) {
          const createdTagCount = createdTags.size;
          let description = "";
          
          if (createdTagCount > 0) {
            description = `Created ${createdTagCount} new tag(s) automatically`;
          }
          
          if (errorCount > 0) {
            toast({ 
              title: `Imported ${successCount} entries (${errorCount} failed)`,
              description: description || undefined
            });
          } else {
            toast({ 
              title: `Imported ${successCount} entries successfully`,
              description: description || undefined
            });
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
        setIsImporting(false);
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
                      This action cannot be undone. This will permanently delete all {totalEntries} entry(ies) from the database.
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

          {(isImporting || importProgress.total > 0) && (
            <Card data-testid="card-import-progress">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isImporting ? (
                      <>
                        <Upload className="w-5 h-5 animate-pulse" />
                        Importing CSV...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Import Complete
                      </>
                    )}
                  </div>
                  {!isImporting && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportProgress({ current: 0, total: 0, successCount: 0, errorCount: 0, errors: [] })}
                      data-testid="button-dismiss-import-result"
                    >
                      Dismiss
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Processing: {importProgress.current} / {importProgress.total} rows
                    </span>
                    <span className="font-medium">
                      {importProgress.total > 0 
                        ? Math.round((importProgress.current / importProgress.total) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <Progress 
                    value={importProgress.total > 0 
                      ? (importProgress.current / importProgress.total) * 100 
                      : 0} 
                    className="h-2"
                    data-testid="progress-import"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Success</p>
                      <p className="text-lg font-semibold text-green-700 dark:text-green-400" data-testid="text-success-count">
                        {importProgress.successCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Errors</p>
                      <p className="text-lg font-semibold text-red-700 dark:text-red-400" data-testid="text-error-count">
                        {importProgress.errorCount}
                      </p>
                    </div>
                  </div>
                </div>

                {importProgress.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Error Details</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setImportProgress(prev => ({ ...prev, errors: [] }))}
                        data-testid="button-clear-errors"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 p-3 bg-muted rounded-md border" data-testid="list-import-errors">
                      {importProgress.errors.map((error, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                      {tags.filter((tag: any) => tag.type === formData.type).map((tag: any) => (
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

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm">Show:</Label>
                  <Select
                    value={currentPageSize.toString()}
                    onValueChange={(value) => updatePagination(1, parseInt(value))}
                  >
                    <SelectTrigger id="pageSize" className="w-20" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">
                    entries per page
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {totalEntries === 0 ? 0 : (currentPage - 1) * currentPageSize + 1} to{" "}
                    {Math.min(currentPage * currentPageSize, totalEntries)} of {totalEntries} entries
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePagination(currentPage - 1, currentPageSize)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>

                    <div className="flex items-center gap-1 mx-2">
                      <span className="text-sm">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updatePagination(currentPage + 1, currentPageSize)}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
