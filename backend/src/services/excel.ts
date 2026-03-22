import ExcelJS from 'exceljs';
import { ICustomer } from '../models/Customer';
import { ITransaction } from '../models/Transaction';
import { IUser } from '../models/User';

const INDIGO = '6366F1';
const LIGHT_GRAY = 'F9FAFB';
const RED = 'DC2626';
const GREEN = '16A34A';

export async function generateCustomerExcel(
  merchant: IUser,
  customer: ICustomer,
  transactions: ITransaction[],
  dateFrom?: Date,
  dateTo?: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UdhaariBook';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Customer Statement');

  // Column widths
  sheet.columns = [
    { key: 'date', width: 18 },
    { key: 'type', width: 12 },
    { key: 'amount', width: 16 },
    { key: 'note', width: 35 },
    { key: 'balance', width: 16 },
  ];

  // Title rows
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'UdhaariBook — Customer Statement';
  titleCell.font = { bold: true, size: 16, color: { argb: `FF${INDIGO}` } };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:E2');
  const subCell = sheet.getCell('A2');
  const periodSuffix = dateFrom && dateTo
    ? ` | Period: ${dateFrom.toLocaleDateString('en-IN')} – ${dateTo.toLocaleDateString('en-IN')}`
    : dateFrom ? ` | From: ${dateFrom.toLocaleDateString('en-IN')}`
    : dateTo ? ` | Until: ${dateTo.toLocaleDateString('en-IN')}`
    : ` | Generated: ${new Date().toLocaleDateString('en-IN')}`;
  subCell.value = `${merchant.businessName} | Customer: ${customer.name}${periodSuffix}`;
  subCell.font = { size: 10, color: { argb: 'FF6B7280' } };
  subCell.alignment = { horizontal: 'center' };

  sheet.addRow([]); // spacer

  // Summary row
  sheet.mergeCells('A4:B4');
  sheet.getCell('A4').value = 'Total Outstanding';
  sheet.getCell('A4').font = { bold: true, size: 11 };
  sheet.getCell('C4').value = customer.totalOutstanding;
  sheet.getCell('C4').numFmt = '₹#,##0.00';
  sheet.getCell('C4').font = {
    bold: true,
    size: 12,
    color: { argb: customer.totalOutstanding > 0 ? `FF${RED}` : `FF${GREEN}` },
  };

  sheet.addRow([]); // spacer

  // Header row
  const headerRow = sheet.addRow(['Date', 'Type', 'Amount (₹)', 'Note', 'Running Balance (₹)']);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${INDIGO}` } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });

  // Data rows
  let runningBalance = 0;
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  sorted.forEach((tx, i) => {
    runningBalance += tx.type === 'gave' ? tx.amount : -tx.amount;
    const row = sheet.addRow([
      new Date(tx.createdAt).toLocaleDateString('en-IN'),
      tx.type === 'gave' ? 'You Gave' : 'You Got',
      tx.amount,
      tx.note ?? '',
      runningBalance,
    ]);

    const bg = i % 2 === 0 ? LIGHT_GRAY : 'FFFFFF';
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } };
    });

    row.getCell('type').font = {
      color: { argb: tx.type === 'gave' ? `FF${RED}` : `FF${GREEN}` },
    };
    row.getCell('amount').numFmt = '#,##0.00';
    row.getCell('balance').numFmt = '#,##0.00';
    row.getCell('balance').font = {
      color: { argb: runningBalance > 0 ? `FF${RED}` : `FF${GREEN}` },
    };
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateBusinessExcel(
  merchant: IUser,
  customers: ICustomer[],
  dateFrom?: Date,
  dateTo?: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UdhaariBook';

  const sheet = workbook.addWorksheet('Business Summary');
  sheet.columns = [
    { key: 'name', width: 25 },
    { key: 'phone', width: 18 },
    { key: 'email', width: 28 },
    { key: 'outstanding', width: 20 },
    { key: 'lastTx', width: 20 },
  ];

  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `UdhaariBook — Business Summary | ${merchant.businessName}`;
  titleCell.font = { bold: true, size: 15, color: { argb: `FF${INDIGO}` } };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:E2');
  const periodText = dateFrom && dateTo
    ? `Period: ${dateFrom.toLocaleDateString('en-IN')} – ${dateTo.toLocaleDateString('en-IN')}`
    : `Generated: ${new Date().toLocaleDateString('en-IN')}`;
  sheet.getCell('A2').value = periodText;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF6B7280' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const totalReceivable = customers.reduce((s, c) => s + Math.max(0, c.totalOutstanding), 0);
  sheet.getCell('A4').value = 'Total Receivable';
  sheet.getCell('A4').font = { bold: true };
  sheet.getCell('B4').value = totalReceivable;
  sheet.getCell('B4').numFmt = '₹#,##0.00';
  sheet.getCell('B4').font = { bold: true, color: { argb: `FF${RED}` } };
  sheet.getCell('D4').value = 'Total Customers';
  sheet.getCell('D4').font = { bold: true };
  sheet.getCell('E4').value = customers.length;

  sheet.addRow([]);

  const headerRow = sheet.addRow(['Customer Name', 'Phone', 'Email', 'Outstanding (₹)', 'Last Transaction']);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${INDIGO}` } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center' };
  });

  const sorted = [...customers].sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  sorted.forEach((c, i) => {
    const row = sheet.addRow([
      c.name,
      c.phone ?? '',
      c.email ?? '',
      c.totalOutstanding,
      c.lastTransactionAt ? new Date(c.lastTransactionAt).toLocaleDateString('en-IN') : '',
    ]);
    const bg = i % 2 === 0 ? LIGHT_GRAY : 'FFFFFF';
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } };
    });
    row.getCell('outstanding').numFmt = '#,##0.00';
    row.getCell('outstanding').font = {
      color: { argb: c.totalOutstanding > 0 ? `FF${RED}` : `FF${GREEN}` },
    };
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
