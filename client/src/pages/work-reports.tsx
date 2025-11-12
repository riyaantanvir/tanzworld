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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// CSV Import types
type ImportRow = {
  index: number;
  originalData: {
    date: string;
    title: string;
    description: string;
    hours: string;
    status: string;
    userName: string;
    userId: string;
  };
  parsedData: WorkReportFormData | null;
  errors: string[];
  status: 'pending' | 'uploading' | 'success' | 'failed';
  failureReason?: string;
};

type ImportState = {
  rows: ImportRow[];
  isOpen: boolean;
  uploadProgress: number;
  isUploading: boolean;
  uploadComplete: boolean;
};

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
  const [importState, setImportState] = useState<ImportState | null>(null);
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

  // Step 1: Parse and validate CSV
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

        // Parse CSV headers
        const headers = lines[0].split(",").map(h => h.trim());
        
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
        const importRows: ImportRow[] = [];

        // Parse and validate each row
        dataRows.forEach((line, index) => {
          const errors: string[] = [];
          
          // Proper CSV parsing that handles empty fields
          const parseCsvLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = line[i + 1];
              
              if (char === '"') {
                if (inQuotes && nextChar === '"') {
                  // Escaped quote
                  current += '"';
                  i++; // Skip next quote
                } else {
                  // Toggle quote state
                  inQuotes = !inQuotes;
                }
              } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            
            // Add last field
            result.push(current.trim());
            return result;
          };
          
          const cleanValues = parseCsvLine(line);
          const [dateStr = "", title = "", description = "", hoursStr = "", status = "submitted", userName = "", userIdFromCsv = ""] = cleanValues;
          
          // Store original data
          const originalData = {
            date: dateStr,
            title,
            description,
            hours: hoursStr,
            status,
            userName,
            userId: userIdFromCsv,
          };

          // Validate required fields
          if (!dateStr) errors.push("Date is required");
          if (!title) errors.push("Title is required");
          if (!hoursStr) errors.push("Hours Worked is required");

          // Parse and validate date
          let parsedDate: Date | null = null;
          if (dateStr) {
            parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) {
              errors.push("Invalid date format");
            }
          }

          // Parse and validate hours
          let hoursWorked = 0;
          let hours = "0";
          let minutes = "0";
          if (hoursStr) {
            hoursWorked = parseFloat(hoursStr);
            if (isNaN(hoursWorked) || hoursWorked <= 0) {
              errors.push("Hours must be greater than 0");
            } else {
              hours = Math.floor(hoursWorked).toString();
              minutes = Math.round((hoursWorked % 1) * 60).toString();
            }
          }

          // Validate status
          const validStatuses = ["submitted", "approved", "rejected"];
          const normalizedStatus = status.toLowerCase().trim();
          if (normalizedStatus && !validStatuses.includes(normalizedStatus)) {
            errors.push(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
          }

          // Determine user ID
          let finalUserId = currentUser?.id || "";
          if (userIdFromCsv && userIdFromCsv.trim() && isAdmin && users.length > 0) {
            const userExists = users.find(u => u.id === userIdFromCsv.trim());
            if (userExists) {
              finalUserId = userIdFromCsv.trim();
            } else {
              errors.push(`User ID "${userIdFromCsv}" not found. Will use current user.`);
            }
          }

          // Create parsed data if no critical errors
          let parsedData: WorkReportFormData | null = null;
          if (errors.length === 0 || (errors.length === 1 && errors[0].includes("Will use current user"))) {
            parsedData = {
              title: title.trim(),
              description: description.trim(),
              date: parsedDate!,
              hours,
              minutes,
              hoursWorked: hoursWorked.toString(),
              status: normalizedStatus as "submitted" | "approved" | "rejected",
              userId: finalUserId,
            };
          }

          importRows.push({
            index: index + 1,
            originalData,
            parsedData,
            errors,
            status: 'pending',
          });
        });

        // Show review dialog
        setImportState({
          rows: importRows,
          isOpen: true,
          uploadProgress: 0,
          isUploading: false,
          uploadComplete: false,
        });

        const validCount = importRows.filter(r => r.errors.length === 0 || (r.errors.length === 1 && r.errors[0].includes("Will use current user"))).length;
        const errorCount = importRows.length - validCount;

        toast({
          title: "CSV parsed successfully",
          description: `Found ${importRows.length} rows: ${validCount} valid, ${errorCount} with errors.`,
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
    event.target.value = "";
  };

  // Step 3: Sequential upload with progress
  const handleConfirmImport = async () => {
    if (!importState) return;

    setImportState(prev => prev ? { ...prev, isUploading: true, uploadProgress: 0 } : null);

    const validRows = importState.rows.filter(r => r.parsedData !== null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      try {
        setImportState(prev => {
          if (!prev) return null;
          const newRows = [...prev.rows];
          const rowIndex = newRows.findIndex(r => r.index === row.index);
          if (rowIndex !== -1) {
            newRows[rowIndex] = { ...newRows[rowIndex], status: 'uploading' };
          }
          return { ...prev, rows: newRows };
        });

        await createMutation.mutateAsync(row.parsedData!);
        
        setImportState(prev => {
          if (!prev) return null;
          const newRows = [...prev.rows];
          const rowIndex = newRows.findIndex(r => r.index === row.index);
          if (rowIndex !== -1) {
            newRows[rowIndex] = { ...newRows[rowIndex], status: 'success' };
          }
          return { ...prev, rows: newRows, uploadProgress: ((i + 1) / validRows.length) * 100 };
        });
        
        successCount++;
      } catch (error: any) {
        setImportState(prev => {
          if (!prev) return null;
          const newRows = [...prev.rows];
          const rowIndex = newRows.findIndex(r => r.index === row.index);
          if (rowIndex !== -1) {
            newRows[rowIndex] = { 
              ...newRows[rowIndex], 
              status: 'failed',
              failureReason: error.message || "Upload failed"
            };
          }
          return { ...prev, rows: newRows, uploadProgress: ((i + 1) / validRows.length) * 100 };
        });
        failCount++;
      }
    }

    setImportState(prev => prev ? { ...prev, isUploading: false, uploadComplete: true } : null);

    toast({
      title: "Import completed",
      description: `Successfully uploaded ${successCount} work reports. ${failCount > 0 ? `${failCount} failed.` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  // Update a row's data in the import preview
  const updateImportRow = (rowIndex: number, field: string, value: any) => {
    if (!importState) return;

    setImportState(prev => {
      if (!prev) return null;
      const newRows = [...prev.rows];
      const row = newRows[rowIndex];
      
      if (!row) return prev;

      // Update original data
      row.originalData = { ...row.originalData, [field]: value };

      // Re-validate
      const errors: string[] = [];
      const { date: dateStr, title, hours: hoursStr, status } = row.originalData;

      if (!dateStr) errors.push("Date is required");
      if (!title) errors.push("Title is required");
      if (!hoursStr) errors.push("Hours Worked is required");

      let parsedDate: Date | null = null;
      if (dateStr) {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          errors.push("Invalid date format");
        }
      }

      let hoursWorked = 0;
      let hours = "0";
      let minutes = "0";
      if (hoursStr) {
        hoursWorked = parseFloat(hoursStr);
        if (isNaN(hoursWorked) || hoursWorked <= 0) {
          errors.push("Hours must be greater than 0");
        } else {
          hours = Math.floor(hoursWorked).toString();
          minutes = Math.round((hoursWorked % 1) * 60).toString();
        }
      }

      row.errors = errors;

      if (errors.length === 0) {
        row.parsedData = {
          title: row.originalData.title.trim(),
          description: row.originalData.description.trim(),
          date: parsedDate!,
          hours,
          minutes,
          hoursWorked: hoursWorked.toString(),
          status: (row.originalData.status.toLowerCase().trim() || "submitted") as any,
          userId: row.originalData.userId || currentUser?.id || "",
        };
      } else {
        row.parsedData = null;
      }

      return { ...prev, rows: newRows };
    });
  };

  // Remove a row from import
  const removeImportRow = (rowIndex: number) => {
    if (!importState) return;
    setImportState(prev => {
      if (!prev) return null;
      return { ...prev, rows: prev.rows.filter((_, i) => i !== rowIndex) };
    });
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

        {/* CSV Import Review Dialog */}
        {importState && (
          <Dialog open={importState.isOpen} onOpenChange={(open) => {
            if (!open && !importState.isUploading) {
              setImportState(null);
            }
          }}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {importState.uploadComplete ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Import Complete
                    </>
                  ) : importState.isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading Work Reports
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      Review Import Data
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {importState.uploadComplete ? (
                    `Upload finished. ${importState.rows.filter(r => r.status === 'success').length} successful, ${importState.rows.filter(r => r.status === 'failed').length} failed.`
                  ) : importState.isUploading ? (
                    `Uploading ${importState.rows.filter(r => r.parsedData !== null).length} work reports...`
                  ) : (
                    `Review and fix any errors before uploading. ${importState.rows.filter(r => r.errors.length === 0 || (r.errors.length === 1 && r.errors[0].includes("Will use current user"))).length} valid, ${importState.rows.filter(r => r.errors.length > 0 && !r.errors[0].includes("Will use current user")).length} with errors.`
                  )}
                </DialogDescription>
              </DialogHeader>

              {importState.isUploading && (
                <div className="space-y-2 py-4">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(importState.uploadProgress)}%</span>
                  </div>
                  <Progress value={importState.uploadProgress} className="h-2" />
                </div>
              )}

              <ScrollArea className="flex-1 pr-4">
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead className="w-32">Date</TableHead>
                        <TableHead className="min-w-[200px]">Title</TableHead>
                        <TableHead className="w-24">Hours</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="min-w-[200px]">Errors</TableHead>
                        {!importState.isUploading && !importState.uploadComplete && (
                          <TableHead className="w-20">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importState.rows.map((row, index) => (
                        <TableRow 
                          key={row.index}
                          className={cn(
                            row.status === 'success' && "bg-green-50 dark:bg-green-950",
                            row.status === 'failed' && "bg-red-50 dark:bg-red-950",
                            row.status === 'uploading' && "bg-blue-50 dark:bg-blue-950",
                            row.errors.length > 0 && !row.errors[0].includes("Will use current user") && row.status === 'pending' && "bg-orange-50 dark:bg-orange-950"
                          )}
                        >
                          <TableCell className="font-medium">{row.index}</TableCell>
                          <TableCell>
                            {row.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                            {row.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                            {row.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                            {row.status === 'pending' && row.errors.length > 0 && !row.errors[0].includes("Will use current user") && (
                              <AlertCircle className="w-4 h-4 text-orange-600" />
                            )}
                            {row.status === 'pending' && (row.errors.length === 0 || row.errors[0].includes("Will use current user")) && (
                              <div className="w-4 h-4 rounded-full bg-green-600" />
                            )}
                          </TableCell>
                          <TableCell>
                            {importState.isUploading || importState.uploadComplete ? (
                              <span className="text-sm">{row.originalData.date}</span>
                            ) : (
                              <Input
                                type="date"
                                value={row.originalData.date}
                                onChange={(e) => updateImportRow(index, 'date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {importState.isUploading || importState.uploadComplete ? (
                              <span className="text-sm">{row.originalData.title}</span>
                            ) : (
                              <Input
                                value={row.originalData.title}
                                onChange={(e) => updateImportRow(index, 'title', e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Enter title"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {importState.isUploading || importState.uploadComplete ? (
                              <span className="text-sm">{row.originalData.hours}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.1"
                                value={row.originalData.hours}
                                onChange={(e) => updateImportRow(index, 'hours', e.target.value)}
                                className="h-8 text-sm"
                                placeholder="0.0"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              row.originalData.status === 'approved' ? 'default' :
                              row.originalData.status === 'rejected' ? 'destructive' : 'secondary'
                            } className="text-xs">
                              {row.originalData.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.status === 'failed' && row.failureReason ? (
                              <span className="text-xs text-red-600">{row.failureReason}</span>
                            ) : row.errors.length > 0 ? (
                              <div className="space-y-1">
                                {row.errors.map((error, i) => (
                                  <div key={i} className="text-xs text-orange-600">{error}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-green-600">Valid</span>
                            )}
                          </TableCell>
                          {!importState.isUploading && !importState.uploadComplete && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeImportRow(index)}
                                className="h-8 w-8 p-0"
                                data-testid={`button-remove-row-${row.index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>

              <DialogFooter className="mt-4">
                {importState.uploadComplete ? (
                  <Button
                    onClick={() => setImportState(null)}
                    data-testid="button-close-import"
                  >
                    Close
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setImportState(null)}
                      disabled={importState.isUploading}
                      data-testid="button-cancel-import"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={
                        importState.isUploading ||
                        importState.rows.filter(r => r.parsedData !== null).length === 0
                      }
                      data-testid="button-confirm-import"
                    >
                      {importState.isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        `Upload ${importState.rows.filter(r => r.parsedData !== null).length} Reports`
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Sidebar>
  );
}