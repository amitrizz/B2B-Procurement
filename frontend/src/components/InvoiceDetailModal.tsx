import { X } from 'lucide-react';

const formatInr = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type InvoiceDetailModalProps = {
  invoice: any;
  onClose: () => void;
};

export default function InvoiceDetailModal({ invoice, onClose }: InvoiceDetailModalProps) {
  if (!invoice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              {invoice.type === 'SUPPLIER_PAYOUT' ? 'Settlement Invoice' : 'Tax Invoice'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{invoice.number}</p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {invoice.paymentNote && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-100">
            {invoice.paymentNote}
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] uppercase text-slate-500 font-bold">
                {invoice.sellerParty?.label || 'Seller'}
              </p>
              <p className="text-white font-semibold mt-1">
                {invoice.sellerParty?.name || invoice.supplierCompany?.name}
              </p>
              <p className="text-[10px] text-slate-400">GSTIN: {invoice.sellerParty?.gstin || '—'}</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] uppercase text-slate-500 font-bold">
                {invoice.buyerParty?.label || 'Buyer'}
              </p>
              <p className="text-white font-semibold mt-1">
                {invoice.buyerParty?.name || invoice.buyerCompany?.name}
              </p>
              <p className="text-[10px] text-slate-400">GSTIN: {invoice.buyerParty?.gstin || '—'}</p>
            </div>
          </div>

          {invoice.purchaseOrder?.poNumber && (
            <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 flex justify-between">
              <span className="text-slate-400">PO</span>
              <span className="text-white font-mono">{invoice.purchaseOrder.poNumber}</span>
            </div>
          )}

          <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 space-y-2">
            {invoice.type === 'TAX_INVOICE' ? (
              <>
                <div className="flex justify-between text-slate-300">
                  <span>Goods value</span>
                  <span>{formatInr(invoice.goodsTaxable ?? 0)}</span>
                </div>
                {(invoice.commissionAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Platform fee</span>
                    <span>{formatInr(invoice.commissionAmount)}</span>
                  </div>
                )}
                {(invoice.feeTaxable ?? invoice.taxable) > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>GST taxable (platform fee)</span>
                    <span>{formatInr(invoice.feeTaxable ?? invoice.taxable)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between text-slate-300">
                <span>Goods settlement</span>
                <span>{formatInr(invoice.goodsTaxable ?? invoice.taxable)}</span>
              </div>
            )}
            {invoice.cgstAmount > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>CGST on platform fee</span>
                <span>{formatInr(invoice.cgstAmount)}</span>
              </div>
            )}
            {invoice.sgstAmount > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>SGST on platform fee</span>
                <span>{formatInr(invoice.sgstAmount)}</span>
              </div>
            )}
            {invoice.igstAmount > 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>IGST on platform fee</span>
                <span>{formatInr(invoice.igstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2">
              <span>Total</span>
              <span>{formatInr(invoice.total)}</span>
            </div>
          </div>

          {invoice.irn && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-200">
              <p className="font-bold text-blue-400 mb-1">E-Invoice (stub)</p>
              <p>IRN: {invoice.irn}</p>
              <p>Ack: {invoice.ackNo}</p>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${
                invoice.status === 'SETTLED' || invoice.status === 'PAID'
                  ? 'bg-green-500/20 text-green-400'
                  : invoice.status === 'PENDING_RELEASE'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {invoice.status === 'SETTLED' && invoice.type === 'SUPPLIER_PAYOUT'
                ? 'PAID TO SUPPLIER'
                : invoice.status}
            </span>
          </div>

          {invoice.lines?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Line items</p>
              <div className="space-y-2">
                {invoice.lines.map((line: any) => (
                  <div key={line.id} className="bg-slate-950/40 rounded-lg p-2 text-xs border border-white/5">
                    <p className="text-white">{line.description}</p>
                    <p className="text-slate-400 mt-1">
                      Qty {line.qty} × {formatInr(line.unitPrice)} = {formatInr(line.taxable)}
                      {line.taxAmount > 0 && (
                        <span className="text-slate-500"> (incl. GST {formatInr(line.taxAmount)})</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
