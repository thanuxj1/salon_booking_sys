import ExcelJS from 'exceljs';
import { format } from 'date-fns';

const STATUS_COLORS = {
  booked:    { argb: 'FFD4EDDA' },  // Green tint
  cancelled: { argb: 'FFF8D7DA' },  // Red tint
  completed: { argb: 'FFD1ECF1' },  // Blue tint
};

/**
 * Generate an Excel workbook from appointments array.
 * Writes directly to the HTTP response stream.
 */
export async function exportToExcel(appointments, res) {
  const workbook  = new ExcelJS.Workbook();
  workbook.creator  = process.env.SALON_NAME || 'Glamour Salon';
  workbook.created  = new Date();

  const ws = workbook.addWorksheet('Appointments', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    properties: { defaultRowHeight: 20 },
  });

  // ── Columns ──────────────────────────────────────────────────────────────
  ws.columns = [
    { header: 'ID',         key: 'id',         width: 8  },
    { header: 'Name',       key: 'name',        width: 22 },
    { header: 'Phone',      key: 'phone',       width: 18 },
    { header: 'Service',    key: 'service',     width: 22 },
    { header: 'Date',       key: 'date',        width: 14 },
    { header: 'Time',       key: 'time',        width: 10 },
    { header: 'Status',     key: 'status',      width: 14 },
    { header: 'Created At', key: 'created_at',  width: 22 },
  ];

  // ── Header row styling ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A154B' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  headerRow.height = 28;

  // ── Data rows ─────────────────────────────────────────────────────────────
  appointments.forEach((appt, idx) => {
    const row = ws.addRow({
      id:         appt.id,
      name:       appt.name,
      phone:      appt.phone,
      service:    appt.service,
      date:       appt.date ? format(new Date(appt.date), 'dd MMM yyyy') : '',
      time:       appt.time ? String(appt.time).slice(0, 5) : '',
      status:     appt.status?.toUpperCase(),
      created_at: appt.created_at
        ? format(new Date(appt.created_at), 'dd MMM yyyy HH:mm')
        : '',
    });

    // Zebra striping + status colour
    const bgColor = STATUS_COLORS[appt.status] || { argb: 'FFFFFFFF' };
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bgColor };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { size: 10 };
    });

    // Alternating mild shade for readability
    if (idx % 2 === 0 && !STATUS_COLORS[appt.status]) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
      });
    }
    row.height = 22;
  });

  // ── Summary row ───────────────────────────────────────────────────────────
  ws.addRow([]);
  const summaryRow = ws.addRow([
    `Total: ${appointments.length} appointments`,
    '', '', '',
    `Booked: ${appointments.filter(a => a.status === 'booked').length}`,
    '',
    `Cancelled: ${appointments.filter(a => a.status === 'cancelled').length}`,
    `Exported: ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
  ]);
  summaryRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  // ── Auto-filter ───────────────────────────────────────────────────────────
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  // ── HTTP headers ──────────────────────────────────────────────────────────
  const filename = `appointments_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}
