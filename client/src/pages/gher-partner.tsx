import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, DollarSign, TrendingUp, TrendingDown, Wallet, Download, Upload, FileDown } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function GherPartner() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [partnerFormData, setPartnerFormData] = useState({
    name: "",
    phone: "",
  });
  const [transactionFormData, setTransactionFormData] = useState({
    partnerId: "",
    date: new Date().toISOString().split('T')[0],
    type: "contribution" as "contribution" | "return" | "withdrawal",
    amount: "",
    notes: "",
  });

  // Fetch partners list
  const { data: partners = [] } = useQuery<any[]>({
    queryKey: ["/api/gher/partners"],
  });

  // Fetch partner summary with financial metrics
  const { data: partnerSummaries = [] } = useQuery<any[]>({
    queryKey: ["/api/gher/partners/summary"],
  });

  // Fetch capital transactions for selected partner
  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: selectedPartnerId 
      ? [`/api/gher/capital-transactions?partnerId=${selectedPartnerId}`]
      : ["/api/gher/capital-transactions"],
    enabled: !!selectedPartnerId,
  });

  // Fetch ALL transactions for export (lazy query)
  const { data: allTransactions = [], refetch: refetchAllTransactions } = useQuery<any[]>({
    queryKey: ["/api/gher/capital-transactions"],
    enabled: false, // Don't fetch automatically, only when needed
  });

  // Partner CRUD mutations
  const createPartnerMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/partners", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners/summary"] });
      toast({ title: "Partner created successfully" });
      handleClosePartnerDialog();
    },
    onError: () => toast({ title: "Failed to create partner", variant: "destructive" }),
  });

  const updatePartnerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/gher/partners/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners/summary"] });
      toast({ title: "Partner updated successfully" });
      handleClosePartnerDialog();
    },
    onError: () => toast({ title: "Failed to update partner", variant: "destructive" }),
  });

  const deletePartnerMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gher/partners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners/summary"] });
      toast({ title: "Partner deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete partner", variant: "destructive" }),
  });

  // Capital transaction mutations
  const createTransactionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/gher/capital-transactions", {
      ...data,
      amount: data.amount.toString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/gher/capital-transactions');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners/summary"] });
      toast({ title: "Transaction added successfully" });
      handleCloseTransactionDialog();
    },
    onError: () => toast({ title: "Failed to add transaction", variant: "destructive" }),
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gher/capital-transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/gher/capital-transactions');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gher/partners/summary"] });
      toast({ title: "Transaction deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete transaction", variant: "destructive" }),
  });

  const handleClosePartnerDialog = () => {
    setIsPartnerDialogOpen(false);
    setEditingPartner(null);
    setPartnerFormData({ name: "", phone: "" });
  };

  const handleCloseTransactionDialog = () => {
    setIsTransactionDialogOpen(false);
    setTransactionFormData({
      partnerId: "",
      date: new Date().toISOString().split('T')[0],
      type: "contribution",
      amount: "",
      notes: "",
    });
  };

  const handleEditPartner = (partner: any) => {
    setEditingPartner(partner);
    setPartnerFormData({
      name: partner.name,
      phone: partner.phone,
    });
    setIsPartnerDialogOpen(true);
  };

  const handleSubmitPartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPartner) {
      updatePartnerMutation.mutate({ id: editingPartner.id, data: partnerFormData });
    } else {
      createPartnerMutation.mutate(partnerFormData);
    }
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    createTransactionMutation.mutate(transactionFormData);
  };

  const handleAddTransaction = (partnerId: string) => {
    setTransactionFormData({
      partnerId,
      date: new Date().toISOString().split('T')[0],
      type: "contribution",
      amount: "",
      notes: "",
    });
    setIsTransactionDialogOpen(true);
  };

  const toggleRow = (partnerId: string) => {
    // Only allow one row expanded at a time
    if (expandedRows.has(partnerId)) {
      // Collapse the current row
      setExpandedRows(new Set());
      setSelectedPartnerId(null);
    } else {
      // Collapse all other rows and expand this one
      setExpandedRows(new Set([partnerId]));
      setSelectedPartnerId(partnerId);
    }
  };

  // Calculate summary totals
  const totals = partnerSummaries.reduce(
    (acc: any, summary: any) => ({
      invested: acc.invested + (summary.invested || 0),
      returned: acc.returned + (summary.returned || 0),
      withdrawn: acc.withdrawn + (summary.withdrawn || 0),
      outstanding: acc.outstanding + (summary.outstanding || 0),
      currentBalance: acc.currentBalance + (summary.currentBalance || 0),
    }),
    { invested: 0, returned: 0, withdrawn: 0, outstanding: 0, currentBalance: 0 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getPartnerName = (partnerId: string) => {
    const partner = partners.find((p: any) => p.id === partnerId);
    return partner?.name || "Unknown";
  };

  const handleExportCSV = async () => {
    try {
      // Fetch ALL transactions for export
      const result = await refetchAllTransactions();
      
      if (!result.data || result.data.length === 0) {
        toast({ title: "No transactions to export", variant: "destructive" });
        return;
      }

      const csvHeaders = "Partner,Date,Type,Amount (BDT),Notes\n";
      const csvRows = result.data.map((txn: any) => {
        const partnerName = getPartnerName(txn.partnerId).replace(/,/g, ";");
        const date = format(new Date(txn.date), "MM/dd/yyyy");
        const type = txn.type;
        const amount = parseFloat(txn.amount);
        const notes = (txn.notes || "").replace(/,/g, ";");
        return `${partnerName},${date},${type},${amount},${notes}`;
      }).join("\n");

      const csvContent = csvHeaders + csvRows;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `partner-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      toast({ title: `${result.data.length} transactions exported successfully` });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Failed to export transactions", variant: "destructive" });
    }
  };

  const handleDownloadExample = () => {
    const exampleCSV = `Partner,Date,Type,Amount (BDT),Notes
Tanvir,11/12/2025,contribution,50000,Initial investment
Tanvir,11/13/2025,withdrawal,5000,Cash withdrawal for personal use
Tanvir,11/14/2025,return,10000,Capital repayment`;
    
    const blob = new Blob([exampleCSV], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "capital-transactions-example.csv";
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
        if (!header.includes("partner") || !header.includes("date") || !header.includes("type") || !header.includes("amount")) {
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

          const [partnerName, dateStr, type, amountStr, notes] = values;

          try {
            // Find partner by name
            const partner = partners.find((p: any) => 
              p.name.toLowerCase() === partnerName.toLowerCase()
            );
            
            if (!partner) {
              errors.push(`Row ${i + 1}: Partner "${partnerName}" not found`);
              errorCount++;
              continue;
            }

            // Parse date
            const dateParts = dateStr.split("/");
            let txnDate: Date;
            
            if (dateParts.length === 3) {
              const [month, day, year] = dateParts;
              txnDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              txnDate = new Date(dateStr);
            }

            if (isNaN(txnDate.getTime())) {
              errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
              errorCount++;
              continue;
            }

            // Parse amount
            const amount = parseFloat(amountStr);
            if (isNaN(amount)) {
              errors.push(`Row ${i + 1}: Invalid amount "${amountStr}"`);
              errorCount++;
              continue;
            }

            // Validate type
            const txnType = type.toLowerCase().trim();
            if (txnType !== "contribution" && txnType !== "return" && txnType !== "withdrawal") {
              errors.push(`Row ${i + 1}: Invalid type "${type}" (must be "contribution", "return", or "withdrawal")`);
              errorCount++;
              continue;
            }

            const txnData = {
              partnerId: partner.id,
              date: txnDate.toISOString().split('T')[0],
              type: txnType,
              amount: amount.toString(),
              notes: notes || "",
            };

            await createTransactionMutation.mutateAsync(txnData);
            successCount++;
          } catch (error: any) {
            console.error(`Row ${i + 1} error:`, error);
            errors.push(`Row ${i + 1}: ${error.message || "Unknown error"}`);
            errorCount++;
          }
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        if (errorCount > 0) {
          toast({
            title: "Import completed with errors",
            description: `${successCount} succeeded, ${errorCount} failed. Check console for details.`,
            variant: "destructive",
          });
          console.error("Import errors:", errors);
        } else {
          toast({
            title: "Import successful",
            description: `${successCount} transactions imported successfully`,
          });
        }
      } catch (error) {
        console.error("Import error:", error);
        toast({ title: "Failed to import CSV", variant: "destructive" });
      }
    };

    reader.readAsText(file);
  };

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">Partner Management</h1>
            <div className="flex gap-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportCSV}
                accept=".csv"
                style={{ display: "none" }}
                data-testid="input-csv-file"
              />
              <Button
                variant="outline"
                onClick={handleDownloadExample}
                data-testid="button-download-example"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Example CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-import-csv"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => setIsPartnerDialogOpen(true)}
                data-testid="button-add-partner"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{formatCurrency(totals.invested)}</div>
                <p className="text-xs text-muted-foreground">All partner contributions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Returned</CardTitle>
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{formatCurrency(totals.returned)}</div>
                <p className="text-xs text-muted-foreground">Capital paid back</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Withdrawn</CardTitle>
                <Wallet className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{formatCurrency(totals.withdrawn)}</div>
                <p className="text-xs text-muted-foreground">Cash withdrawals</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Capital</CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{formatCurrency(totals.outstanding)}</div>
                <p className="text-xs text-muted-foreground">Active capital in business</p>
              </CardContent>
            </Card>
          </div>

          {/* Partners Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Share %</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Withdrawn</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No partners found. Add your first partner to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    partnerSummaries.map((summary: any) => {
                      const isExpanded = expandedRows.has(summary.partnerId);
                      const partnerTransactions = selectedPartnerId === summary.partnerId ? transactions : [];

                      return (
                        <>
                          <TableRow key={summary.partnerId} data-testid={`row-partner-${summary.partnerId}`}>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleRow(summary.partnerId)}
                                data-testid={`button-expand-${summary.partnerId}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">{summary.partnerName}</TableCell>
                            <TableCell>
                              {partners.find((p: any) => p.id === summary.partnerId)?.phone || "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{summary.sharePercentage}%</Badge>
                            </TableCell>
                            <TableCell className="text-right">৳{formatCurrency(summary.invested)}</TableCell>
                            <TableCell className="text-right">৳{formatCurrency(summary.outstanding)}</TableCell>
                            <TableCell className="text-right">৳{formatCurrency(summary.withdrawn)}</TableCell>
                            <TableCell className="text-right">
                              <span className={summary.currentBalance >= 0 ? "text-green-600" : "text-red-600"}>
                                ৳{formatCurrency(summary.currentBalance)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditPartner(
                                    partners.find((p: any) => p.id === summary.partnerId)
                                  )}
                                  data-testid={`button-edit-${summary.partnerId}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAddTransaction(summary.partnerId)}
                                  data-testid={`button-add-transaction-${summary.partnerId}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deletePartnerMutation.mutate(summary.partnerId)}
                                  data-testid={`button-delete-${summary.partnerId}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expandable Transaction Details */}
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/50 p-0">
                                <div className="p-4">
                                  <h4 className="font-medium mb-3">Capital Transactions</h4>
                                  {partnerTransactions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Type</TableHead>
                                          <TableHead className="text-right">Amount</TableHead>
                                          <TableHead>Notes</TableHead>
                                          <TableHead>Actions</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {partnerTransactions.map((txn: any) => (
                                          <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                                            <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                              <Badge
                                                variant={
                                                  txn.type === "contribution"
                                                    ? "default"
                                                    : txn.type === "return"
                                                    ? "secondary"
                                                    : "outline"
                                                }
                                              >
                                                {txn.type}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">৳{formatCurrency(parseFloat(txn.amount))}</TableCell>
                                            <TableCell>{txn.notes || "-"}</TableCell>
                                            <TableCell>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => deleteTransactionMutation.mutate(txn.id)}
                                                data-testid={`button-delete-transaction-${txn.id}`}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Partner Dialog */}
      <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPartner ? "Edit Partner" : "Add New Partner"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitPartner} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={partnerFormData.name}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, name: e.target.value })}
                required
                data-testid="input-partner-name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={partnerFormData.phone}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, phone: e.target.value })}
                required
                data-testid="input-partner-phone"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createPartnerMutation.isPending || updatePartnerMutation.isPending}
                data-testid="button-save-partner"
              >
                {editingPartner ? "Update" : "Create"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClosePartnerDialog}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Capital Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={transactionFormData.date}
                onChange={(e) => setTransactionFormData({ ...transactionFormData, date: e.target.value })}
                required
                data-testid="input-transaction-date"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={transactionFormData.type}
                onValueChange={(value: any) => setTransactionFormData({ ...transactionFormData, type: value })}
              >
                <SelectTrigger data-testid="select-transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contribution">Contribution</SelectItem>
                  <SelectItem value="return">Return (Capital Repayment)</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal (Cash)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (BDT)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={transactionFormData.amount}
                onChange={(e) => setTransactionFormData({ ...transactionFormData, amount: e.target.value })}
                required
                data-testid="input-transaction-amount"
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={transactionFormData.notes}
                onChange={(e) => setTransactionFormData({ ...transactionFormData, notes: e.target.value })}
                data-testid="input-transaction-notes"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createTransactionMutation.isPending}
                data-testid="button-save-transaction"
              >
                Add Transaction
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseTransactionDialog}
                data-testid="button-cancel-transaction"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
