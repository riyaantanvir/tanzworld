import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  RefreshCw, 
  Plus, 
  Edit, 
  Trash2,
  Calendar,
  Clock,
  FileText,
  Download,
  Upload
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { insertWorkReportSchema, type WorkReport, type User, UserRole } from "@shared/schema";
import Sidebar from "@/components/layout/Sidebar";

// Form schemas
const workReportFormSchema = insertWorkReportSchema.extend({
  date: z.coerce.date({
    required_error: "Date is required",
  }),
  hours: z.string().refine((val) => {
    if (val === "") return true; // Allow empty hours if minutes are provided
    const num = parseInt(val);
    return !isNaN(num) && num >= 0;
  }, "Hours must be a valid number 0 or greater"),
  minutes: z.string().refine((val) => {
    if (val === "") return true; // Allow empty minutes if hours are provided
    const num = parseInt(val);
    return !isNaN(num) && num >= 0 && num < 60;
  }, "Minutes must be between 0-59"),
}).refine((data) => {
  // At least one of hours or minutes must have a value > 0
  const hours = parseInt(data.hours) || 0;
  const minutes = parseInt(data.minutes) || 0;
  return hours > 0 || minutes > 0;
}, {
  message: "Please enter at least some hours or minutes"
  // Removed path so error shows generally, not on specific field
});

type WorkReportFormData = z.infer<typeof workReportFormSchema>;

export default function WorkReportsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("all"); // For admin user filtering
  const [timePeriod, setTimePeriod] = useState<string>("all"); // Time period filter
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingWorkReport, setEditingWorkReport] = useState<WorkReport | null>(null);
  const { toast } = useToast();

  // Get current user info
  const userStr = localStorage.getItem("user");
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  // Fetch work reports
  const { data: workReports = [], isLoading, error, refetch } = useQuery<WorkReport[]>({
    queryKey: ["/api/work-reports"],
  });

  // Fetch users for admin user selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin, // Only fetch if user is admin
  });

  // Create work report mutation
  const createMutation = useMutation({
    mutationFn: async (data: WorkReportFormData) => {
      // Convert hours and minutes to decimal hours
      const hours = parseInt(data.hours) || 0;
      const minutes = parseInt(data.minutes) || 0;
      const hoursWorked = hours + (minutes / 60);
      
      const response = await apiRequest("POST", "/api/work-reports", {
        title: data.title,
        description: data.description,
        date: data.date,
        hoursWorked: hoursWorked.toString(),
        status: data.status,
        userId: data.userId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Work report created",
        description: "Your work report has been submitted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work report",
        variant: "destructive",
      });
    },
  });

  // Update work report mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkReportFormData> }) => {
      // Convert hours and minutes to decimal hours
      const hours = parseInt(data.hours || "0") || 0;
      const minutes = parseInt(data.minutes || "0") || 0;
      const hoursWorked = hours + (minutes / 60);
      
      const response = await apiRequest("PUT", `/api/work-reports/${id}`, {
        title: data.title,
        description: data.description,
        date: data.date,
        hoursWorked: hoursWorked.toString(),
        status: data.status,
        userId: data.userId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
      setIsEditDialogOpen(false);
      setEditingWorkReport(null);
      toast({
        title: "Work report updated",
        description: "Your work report has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update work report",
        variant: "destructive",
      });
    },
  });

  // Delete work report mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/work-reports/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
      toast({
        title: "Work report deleted",
        description: "The work report has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete work report",
        variant: "destructive",
      });
    },
  });

  // Delete all work reports mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/work-reports/all");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
      toast({
        title: "All work reports deleted",
        description: `Successfully deleted ${data.deletedCount} work report${data.deletedCount !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete work reports",
        variant: "destructive",
      });
    },
  });

  // Create form
  const createForm = useForm<WorkReportFormData>({
    resolver: zodResolver(workReportFormSchema),
    defaultValues: {
      title: "",
      description: "",
      hours: "",
      minutes: "",
      date: new Date(),
      status: "submitted",
      userId: currentUser?.id || "",
    },
  });

  // Edit form
  const editForm = useForm<WorkReportFormData>({
    resolver: zodResolver(workReportFormSchema),
  });

  // Handle form submission
  const onCreateSubmit = (data: WorkReportFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: WorkReportFormData) => {
    if (editingWorkReport) {
      updateMutation.mutate({ id: editingWorkReport.id, data });
    }
  };

  // Handle editing
  const handleEdit = (workReport: WorkReport) => {
    setEditingWorkReport(workReport);
    
    // Convert decimal hours back to hours and minutes
    const totalHours = parseFloat(workReport.hoursWorked.toString());
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    
    editForm.reset({
      title: workReport.title,
      description: workReport.description,
      hours: hours.toString(),
      minutes: minutes.toString(),
      date: new Date(workReport.date),
      status: workReport.status,
      userId: workReport.userId,
    });
    setIsEditDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Handle delete all
  const handleDeleteAll = () => {
    deleteAllMutation.mutate();
  };

  // CSV Export function
  const handleExportCSV = () => {
    if (filteredWorkReports.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no work reports to export.",
        variant: "destructive",
      });
      return;
    }

    // Prepare CSV data
    const csvHeaders = [
      "Date",
      "Title", 
      "Description",
      "Hours Worked",
      "Status",
      "User",
      "User ID"
    ];

    const csvData = filteredWorkReports.map(report => {
      const user = users.find(u => u.id === report.userId);
      return [
        format(new Date(report.date), "yyyy-MM-dd"),
        `"${report.title.replace(/"/g, '""')}"`, // Escape quotes in title
        `"${(report.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
        report.hoursWorked.toString(),
        report.status,
        `"${(user?.name || user?.username || 'Unknown').replace(/"/g, '""')}"`, // Escape quotes in user name
        report.userId
      ];
    });

    // Create CSV content
    const csvContent = [csvHeaders.join(","), ...csvData.map(row => row.join(","))].join("\n");
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `work-reports-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${filteredWorkReports.length} work reports to CSV.`,
    });
  };

  // CSV Import function
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
      return;
    }

    // For multi-user import, ensure admin privileges and users data is loaded
    if (isAdmin && (!users || users.length === 0)) {
      toast({
        title: "User data not loaded",
        description: "Please wait for user data to load before importing CSV files.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const lines = csvContent.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Empty file",
            description: "The CSV file appears to be empty or has no data rows.",
            variant: "destructive",
          });
          return;
        }

        // Parse CSV (simple parsing - assumes proper formatting)
        const headers = lines[0].split(",").map(h => h.trim());
        const expectedHeaders = ["Date", "Title", "Description", "Hours Worked", "Status", "User", "User ID"];
        
        // Validate headers
        const hasRequiredHeaders = ["Date", "Title", "Hours Worked"].every(required => 
          headers.some(h => h.toLowerCase().includes(required.toLowerCase()))
        );

        if (!hasRequiredHeaders) {
          toast({
            title: "Invalid CSV format",
            description: "CSV must contain at least: Date, Title, Hours Worked columns.",
            variant: "destructive",
          });
          return;
        }

        const dataRows = lines.slice(1);
        let importedCount = 0;
        let skippedCount = 0;

        // Process each row
        dataRows.forEach((line, index) => {
          try {
            // Simple CSV parsing - split by comma and handle quoted values
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            const cleanValues = values.map(v => v.replace(/^"/, '').replace(/"$/, '').trim());

            if (cleanValues.length < 4) {
              skippedCount++;
              return;
            }

            const [dateStr, title, description, hoursStr, status = "submitted", userName, userIdFromCsv] = cleanValues;
            
            // Validate required fields
            if (!dateStr || !title || !hoursStr) {
              skippedCount++;
              return;
            }

            // Parse date
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              skippedCount++;
              return;
            }

            // Parse hours
            const hoursWorked = parseFloat(hoursStr);
            if (isNaN(hoursWorked) || hoursWorked <= 0) {
              skippedCount++;
              return;
            }

            // Determine the user ID to use
            let finalUserId = currentUser?.id || "";
            
            // If User ID is provided in CSV, validate it (only for admins with loaded user data)
            if (userIdFromCsv && userIdFromCsv.trim() && isAdmin && users.length > 0) {
              const userExists = users.find(u => u.id === userIdFromCsv.trim());
              if (userExists) {
                finalUserId = userIdFromCsv.trim();
              }
              // If User ID doesn't exist, fall back to current user but don't skip the row
            }

            // Create work report data
            const workReportData = {
              title: title.trim(),
              description: description?.trim() || "",
              date,
              hoursWorked,
              status: (status.trim() || "submitted") as "submitted" | "approved" | "rejected",
              userId: finalUserId,
            };

            // Submit via mutation
            createMutation.mutate({
              title: workReportData.title,
              description: workReportData.description,
              hoursWorked: workReportData.hoursWorked.toString(),
              hours: Math.floor(workReportData.hoursWorked).toString(),
              minutes: Math.round((workReportData.hoursWorked % 1) * 60).toString(),
              date: workReportData.date,
              status: workReportData.status,
              userId: workReportData.userId,
            });

            importedCount++;
          } catch (error) {
            skippedCount++;
          }
        });

        toast({
          title: "Import completed",
          description: `Imported ${importedCount} work reports. ${skippedCount > 0 ? `Skipped ${skippedCount} invalid rows.` : ''}`,
        });

      } catch (error) {
        toast({
          title: "Import failed",
          description: "Failed to parse CSV file. Please check the format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    
    // Reset the input
    event.target.value = "";
  };

  // Get date range based on time period filter
  const getDateRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case "this-month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case "last-month": {
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth),
        };
      }
      case "custom":
        return {
          start: customStartDate,
          end: customEndDate,
        };
      default:
        return { start: undefined, end: undefined };
    }
  };

  // Filter work reports based on search term, selected user, and time period
  const filteredWorkReports = workReports.filter((report) => {
    const matchesSearch = report.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUser = !isAdmin || !selectedUserId || selectedUserId === "all" || report.userId === selectedUserId;
    
    // Time period filtering (only for admins)
    let matchesTimePeriod = true;
    if (isAdmin && timePeriod !== "all") {
      const { start, end } = getDateRange();
      if (start && end) {
        const reportDate = new Date(report.date);
        matchesTimePeriod = reportDate >= start && reportDate <= end;
      } else if (timePeriod === "custom" && (!customStartDate || !customEndDate)) {
        matchesTimePeriod = true; // Show all if custom dates not selected yet
      }
    }
    
    return matchesSearch && matchesUser && matchesTimePeriod;
  });

  // Calculate total hours
  const totalHours = filteredWorkReports.reduce((sum, report) => sum + parseFloat(report.hoursWorked.toString()), 0);
  const totalHoursAllReports = workReports.reduce((sum, report) => sum + parseFloat(report.hoursWorked.toString()), 0);

  // Reset create form when dialog opens
  const handleCreateDialogOpen = () => {
    createForm.reset({
      title: "",
      description: "",
      hoursWorked: "1",
      date: new Date(),
      status: "submitted",
      userId: currentUser?.id || "",
    });
    setIsCreateDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "submitted":
        return "default";
      case "approved":
        return "secondary";
      case "draft":
        return "outline";
      default:
        return "default";
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name || user.username : "Unknown User";
  };

  if (error) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Work Reports</h1>
            <p className="text-gray-600 dark:text-gray-400">Please try refreshing the page.</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
                Work Reports
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Track your work hours and submit reports
              </p>
            </div>
            <Button 
              onClick={handleCreateDialogOpen}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-work-report"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Work Report
            </Button>
          </div>


          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search work reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              {/* User Filter for Admins */}
              {isAdmin && (
                <div className="min-w-[200px]">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-user-filter">
                      <SelectValue placeholder="Filter by user..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-all-users">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
                          {user.name || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Time Period Filter for Admins */}
              {isAdmin && (
                <div className="min-w-[200px]">
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger data-testid="select-time-period">
                      <SelectValue placeholder="Filter by time..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-all-time">All Time</SelectItem>
                      <SelectItem value="this-month" data-testid="option-this-month">This Month</SelectItem>
                      <SelectItem value="last-month" data-testid="option-last-month">Last Month</SelectItem>
                      <SelectItem value="custom" data-testid="option-custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Date Range for Admins */}
              {isAdmin && timePeriod === "custom" && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                        data-testid="button-start-date"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                        data-testid="button-end-date"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {/* CSV Export Button */}
              <Button 
                variant="outline" 
                onClick={handleExportCSV}
                disabled={isLoading || filteredWorkReports.length === 0}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              {/* CSV Import Button */}
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  data-testid="input-import-csv"
                />
                <Button 
                  variant="outline"
                  disabled={isLoading || (isAdmin && (!users || users.length === 0))}
                  data-testid="button-import-csv"
                  title={isAdmin && (!users || users.length === 0) ? "Waiting for user data to load..." : "Import CSV file"}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
              </div>

              <Button 
                variant="outline" 
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Delete All Button - Admin Only */}
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      disabled={isLoading || workReports.length === 0}
                      data-testid="button-delete-all"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Work Reports?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {workReports.length} work report{workReports.length !== 1 ? 's' : ''} from the database. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteAll}
                        className="bg-destructive hover:bg-destructive/90"
                        data-testid="button-confirm-delete-all"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Work Reports History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Work Reports History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading work reports...</p>
                </div>
              ) : filteredWorkReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No work reports found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchTerm ? "Try adjusting your search terms." : "Start by creating your first work report."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Task Details</TableHead>
                        <TableHead>Hours</TableHead>
                        {isAdmin && <TableHead>User</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Comments</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWorkReports.map((report) => (
                        <TableRow key={report.id} data-testid={`row-work-report-${report.id}`}>
                          <TableCell data-testid={`text-date-${report.id}`}>
                            {format(new Date(report.date), "PPP")}
                          </TableCell>
                          <TableCell data-testid={`text-title-${report.id}`}>
                            <div className="font-medium">{report.title}</div>
                          </TableCell>
                          <TableCell data-testid={`text-hours-${report.id}`}>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {parseFloat(report.hoursWorked.toString()).toFixed(1)}h
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell data-testid={`text-user-${report.id}`}>
                              {getUserName(report.userId)}
                            </TableCell>
                          )}
                          <TableCell data-testid={`status-${report.id}`}>
                            <Badge variant={getStatusBadgeVariant(report.status)}>
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-description-${report.id}`}>
                            <div className="max-w-xs truncate">
                              {report.description || "No comments"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(report)}
                                data-testid={`button-edit-${report.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    data-testid={`button-delete-${report.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Work Report</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this work report? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(report.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Total Hours Display */}
              {filteredWorkReports.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-t">
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">
                        Filtered Hours: 
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white ml-2" data-testid="text-filtered-hours">
                        {totalHours.toFixed(1)} hours
                      </span>
                    </div>
                    {(timePeriod !== "all" || selectedUserId !== "all") && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Hours (All): 
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white ml-2" data-testid="text-total-hours">
                          {totalHoursAllReports.toFixed(1)} hours
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Create Work Report Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Work Report</DialogTitle>
              <DialogDescription>
                Submit a new work report with your completed tasks and hours worked.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                {isAdmin && (
                  <FormField
                    control={createForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-user">
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name || user.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={createForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Details</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Describe what you worked on..." 
                          {...field}
                          data-testid="input-task-details"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Working Time - Hours and Minutes */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="input-working-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minutes</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            max="59"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="input-working-minutes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any additional comments about your work..."
                          rows={3}
                          {...field}
                          data-testid="input-comments"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? "Creating..." : "Submit Report"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Work Report Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Work Report</DialogTitle>
              <DialogDescription>
                Update your work report details.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                {isAdmin && (
                  <FormField
                    control={editForm.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-user">
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name || user.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={editForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="input-edit-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Details</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Describe what you worked on..." 
                          {...field}
                          data-testid="input-edit-task-details"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Working Time - Hours and Minutes */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="input-edit-working-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="minutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minutes</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            max="59"
                            placeholder="0" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="input-edit-working-minutes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comments</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any additional comments about your work..."
                          rows={3}
                          {...field}
                          data-testid="input-edit-comments"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                    data-testid="button-edit-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    data-testid="button-edit-submit"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Report"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Sidebar>
  );
}