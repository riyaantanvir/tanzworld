import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import Sidebar from "@/components/layout/Sidebar";

export default function GherDashboard() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [partnerId, setPartnerId] = useState("");

  const { data: partners = [] } = useQuery({
    queryKey: ["/api/gher/partners"],
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (partnerId) params.append("partnerId", partnerId);
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const { data: stats = { totalIncome: 0, totalExpense: 0, netBalance: 0 } } = useQuery({
    queryKey: ["/api/gher/dashboard-stats" + buildQueryString(), startDate, endDate, partnerId],
    enabled: true,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["/api/gher/entries" + buildQueryString(), startDate, endDate, partnerId],
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["/api/gher/tags"],
  });

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setPartnerId("");
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find((t: any) => t.id === tagId);
    return tag?.name || "-";
  };

  const getPartnerName = (partId: string) => {
    const partner = partners.find((p: any) => p.id === partId);
    return partner?.name || "-";
  };

  return (
    <Sidebar>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Gher Management Dashboard</h1>
          </div>

          <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-md border"
              data-testid="input-start-date"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-md border"
              data-testid="input-end-date"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Partner</label>
            <Select value={partnerId || "all"} onValueChange={(value) => setPartnerId(value === "all" ? "" : value)}>
              <SelectTrigger className="w-48" data-testid="select-partner">
                <SelectValue placeholder="All Partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Partners</SelectItem>
                {partners.map((partner: any) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={handleReset} data-testid="button-reset-filters">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600 dark:text-green-400" data-testid="text-total-income">
              ৳{stats.totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-total-expense">
              ৳{stats.totalExpense.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-semibold ${
                stats.netBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
              data-testid="text-net-balance"
            >
              ৳{stats.netBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
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
                    <TableCell>{getPartnerName(entry.partnerId)}</TableCell>
                    <TableCell>{getTagName(entry.tagId)}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.details || "-"}</TableCell>
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
