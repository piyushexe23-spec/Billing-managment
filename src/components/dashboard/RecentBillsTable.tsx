import React from "react";
import { RecentBillItem } from "@/types/dashboard";
import { formatCurrencyINR } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Receipt, Clock, CreditCard, Banknote, Smartphone } from "lucide-react";

interface RecentBillsTableProps {
  bills: RecentBillItem[];
}

export const RecentBillsTable: React.FC<RecentBillsTableProps> = ({ bills }) => {
  const getPaymentBadge = (mode: string) => {
    switch (mode) {
      case "UPI":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Smartphone className="h-2.5 w-2.5" /> UPI
          </span>
        );
      case "CARD":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <CreditCard className="h-2.5 w-2.5" /> CARD
          </span>
        );
      case "CASH":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
            <Banknote className="h-2.5 w-2.5" /> CASH
          </span>
        );
    }
  };

  return (
    <Card className="border border-medical-slate-200/80 bg-white shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-medical-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-medical-navy-50 text-medical-navy-700 border border-medical-navy-100">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-medical-navy-900">
              Recent Invoices & Bills
            </CardTitle>
            <p className="text-xs text-medical-slate-500">
              Latest 5 customer billing transactions
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-medical-slate-500 bg-medical-slate-100 px-2 py-0.5 rounded-full">
          Read-Only Ledger
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-medical-slate-50 text-medical-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-medical-slate-100 select-none">
              <tr>
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-5">Customer / Patient</th>
                <th className="py-3 px-5">Date & Time</th>
                <th className="py-3 px-5">Payment Mode</th>
                <th className="py-3 px-5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-medical-slate-100">
              {bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="hover:bg-medical-slate-50/70 transition-colors"
                >
                  {/* Bill Number */}
                  <td className="py-3.5 px-5 font-mono font-bold text-medical-navy-900">
                    {bill.billNumber}
                  </td>

                  {/* Customer / Doctor */}
                  <td className="py-3.5 px-5">
                    <span className="font-semibold text-medical-slate-900 block">
                      {bill.customerName}
                    </span>
                    {bill.doctorName && (
                      <span className="text-[10px] text-medical-slate-400">
                        Ref: {bill.doctorName}
                      </span>
                    )}
                  </td>

                  {/* Date & Time */}
                  <td className="py-3.5 px-5 text-medical-slate-500 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-medical-slate-600">
                      <Clock className="h-3 w-3 text-medical-slate-400" />
                      {bill.dateTime}
                    </span>
                  </td>

                  {/* Payment Mode */}
                  <td className="py-3.5 px-5">
                    {getPaymentBadge(bill.paymentMode)}
                  </td>

                  {/* Total Amount */}
                  <td className="py-3.5 px-5 text-right font-bold text-sm text-medical-navy-900">
                    {formatCurrencyINR(bill.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
