import jsPDF from "jspdf";

interface PDFExportOptions {
  userName?: string;
  dateRange?: { from: string; to: string };
  period?: string;
  data: Array<{
    Date: string;
    Day: string;
    'Work Type': string;
    Project: string;
    'Start Time': string;
    'End Time': string;
    Hours: number;
    'Hours (HH:MM)': string;
    Notes: string;
    'User Name'?: string;
    'User Email'?: string;
  }>;
}

export const createPDF = (options: PDFExportOptions, filename: string) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Colors matching website theme
  const orangeColor = '#EA580C';
  const lightOrange = '#FFF4E6';
  const darkGray = '#1F2937';
  const lightGray = '#F3F4F6';

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 234, g: 88, b: 12 };
  };

  const orangeRgb = hexToRgb(orangeColor);
  const lightOrangeRgb = hexToRgb(lightOrange);

  let yPos = 20;

  // Header section with orange background
  doc.setFillColor(orangeRgb.r, orangeRgb.g, orangeRgb.b);
  doc.rect(10, 10, 277, 25, 'F');
  
  // Logo/Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BAMPRO MARINE - Timesheet', 15, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Urenregistratie Systeem', 15, 28);

  yPos = 40;

  // Information section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  
  if (options.userName) {
    doc.text('Employee Name:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(options.userName, 60, yPos);
    yPos += 7;
  }

  if (options.dateRange) {
    doc.setFont('helvetica', 'bold');
    doc.text('Period:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`From: ${options.dateRange.from} To: ${options.dateRange.to}`, 60, yPos);
    yPos += 7;
  }

  if (options.period) {
    doc.setFont('helvetica', 'bold');
    doc.text('Period Type:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(options.period, 60, yPos);
    yPos += 7;
  }

  // Calculate total hours
  const totalHours = options.data.reduce((sum, row) => sum + (row.Hours || 0), 0);
  const totalHoursHH = Math.floor(totalHours);
  const totalHoursMM = Math.round((totalHours % 1) * 60);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Hours:', 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalHours.toFixed(2)} hours (${String(totalHoursHH).padStart(2, '0')}:${String(totalHoursMM).padStart(2, '0')})`, 60, yPos);
  yPos += 10;

  // Table header with light orange background
  const tableStartY = yPos;
  const colWidths = [25, 25, 40, 35, 20, 20, 20, 25, 50];
  const headers = ['Date', 'Day', 'Work Type', 'Project', 'Start', 'End', 'Hours', 'HH:MM', 'Notes'];
  
  // Check if user columns needed
  const hasUserColumns = options.data.length > 0 && options.data[0]['User Name'] !== undefined;
  if (hasUserColumns) {
    colWidths.push(40, 50);
    headers.push('User Name', 'User Email');
  }

  // Header row background
  doc.setFillColor(lightOrangeRgb.r, lightOrangeRgb.g, lightOrangeRgb.b);
  doc.rect(10, tableStartY - 5, 277, 8, 'F');

  // Header text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  let xPos = 12;
  headers.forEach((header, index) => {
    doc.text(header, xPos, tableStartY);
    xPos += colWidths[index];
  });

  yPos = tableStartY + 8;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  options.data.forEach((row, index) => {
    // Alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(lightGray === '#F3F4F6' ? 243 : 255, 244, 246);
    }
    doc.rect(10, yPos - 4, 277, 6, 'F');

    xPos = 12;
    const rowData = [
      row.Date,
      row.Day,
      row['Work Type'],
      row.Project,
      row['Start Time'],
      row['End Time'],
      row.Hours.toFixed(2),
      row['Hours (HH:MM)'],
      row.Notes || ''
    ];

    if (hasUserColumns) {
      rowData.push(row['User Name'] || '', row['User Email'] || '');
    }

    rowData.forEach((cell, cellIndex) => {
      // Truncate long text
      const maxWidth = colWidths[cellIndex] - 2;
      let cellText = String(cell || '');
      if (doc.getTextWidth(cellText) > maxWidth) {
        cellText = doc.splitTextToSize(cellText, maxWidth)[0] || cellText.substring(0, 20) + '...';
      }
      doc.text(cellText, xPos, yPos);
      xPos += colWidths[cellIndex];
    });

    yPos += 6;

    // New page if needed
    if (yPos > 190) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Page ${i} of ${pageCount}`, 280, 200, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 15, 200);
  }

  // Save PDF
  doc.save(filename);
};

