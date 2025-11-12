import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FileText, Download, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import Sidebar from "@/components/layout/Sidebar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function GherInvoice() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showPreview, setShowPreview] = useState(false);
  const [notes, setNotes] = useState("");

  // Fetch preview data
  const { data: previewData, refetch: refetchPreview, isFetching: isLoadingPreview } = useQuery<{
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    topIncomeTags: any[];
    topExpenseTags: any[];
    partnerMovements: any[];
    incomeEntries: any[];
    expenseEntries: any[];
  }>({
    queryKey: [`/api/gher/invoices/preview?month=${selectedMonth}`],
    enabled: false,
  });

  // Fetch existing invoices (fetch all invoices, filter on client side)
  const { data: allInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/gher/invoices"],
  });
  
  // Filter invoices by selected month on client side
  const invoices = allInvoices.filter(invoice => invoice.yearMonth === selectedMonth);

  // Generate invoice mutation
  const generateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/invoices"] });
      toast({ title: "Invoice generated successfully" });
      setShowPreview(false);
      setNotes("");
    },
    onError: () => toast({ title: "Failed to generate invoice", variant: "destructive" }),
  });

  // Delete invoice mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gher/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/invoices"] });
      toast({ title: "Invoice deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete invoice", variant: "destructive" }),
  });

  const handlePreview = async () => {
    await refetchPreview();
    setShowPreview(true);
  };

  const handleGenerate = () => {
    generateMutation.mutate({
      month: selectedMonth,
      notes: notes || null,
    });
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleDownload = async (invoiceId: string, format: 'pdf' | 'csv') => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/gher/invoices/${invoiceId}/${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: `Failed to download ${format.toUpperCase()}`, variant: "destructive" });
    }
  };

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-invoice">Gher Invoice</h1>
            <p className="text-muted-foreground">Generate monthly financial statements</p>
          </div>

          {/* Month Selection & Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Generate Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="month">Select Month</Label>
                  <Input
                    id="month"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                    data-testid="input-month"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={handlePreview} 
                    disabled={isLoadingPreview}
                    data-testid="button-preview"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {isLoadingPreview ? "Loading..." : "Preview"}
                  </Button>
                </div>
              </div>

              {showPreview && previewData && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Total Income</div>
                        <div className="text-2xl font-bold text-green-600" data-testid="text-total-income">
                          {formatCurrency(previewData.totalIncome)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Total Expense</div>
                        <div className="text-2xl font-bold text-red-600" data-testid="text-total-expense">
                          {formatCurrency(previewData.totalExpense)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Net Balance</div>
                        <div className={`text-2xl font-bold ${previewData.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-net-balance">
                          {formatCurrency(previewData.netBalance)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any remarks or adjustments..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      data-testid="input-notes"
                    />
                  </div>

                  <Button 
                    onClick={handleGenerate} 
                    disabled={generateMutation.isPending}
                    className="w-full"
                    data-testid="button-generate"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {generateMutation.isPending ? "Generating..." : "Generate Invoice"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Invoices List */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invoices generated yet for this month
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice: any) => (
                    <div 
                      key={invoice.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`card-invoice-${invoice.id}`}
                    >
                      <div>
                        <div className="font-semibold" data-testid={`text-invoice-number-${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Generated: {format(new Date(invoice.generatedAt), "MMM dd, yyyy")}
                        </div>
                        <div className="text-sm">
                          Net Balance: <span className={invoice.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(invoice.netBalance)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(invoice.id, 'pdf')}
                          data-testid={`button-pdf-${invoice.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(invoice.id, 'csv')}
                          data-testid={`button-csv-${invoice.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          CSV
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid={`button-delete-${invoice.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete invoice {invoice.invoiceNumber}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate(invoice.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Sidebar>
  );
}
