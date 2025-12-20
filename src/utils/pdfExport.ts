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
  doc.text('Hours Registration System', 15, 28);

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
  
  // Check if user columns needed
  const hasUserColumns = options.data.length > 0 && options.data[0]['User Name'] !== undefined;
  
  // Calculate column widths based on available space (277mm total width, 20mm margins = 257mm usable)
  // Adjust widths to fit better
  let colWidths: number[];
  let headers: string[];
  
  if (hasUserColumns) {
    // With user columns: Date, Day, Work Type, Project, Start, End, Hours, HH:MM, Notes, User Name, User Email
    colWidths = [18, 18, 30, 30, 15, 15, 15, 18, 35, 30, 35];
    headers = ['Date', 'Day', 'Work Type', 'Project', 'Start', 'End', 'Hours', 'HH:MM', 'Notes', 'User Name', 'User Email'];
  } else {
    // Without user columns: Date, Day, Work Type, Project, Start, End, Hours, HH:MM, Notes
    colWidths = [20, 20, 35, 40, 18, 18, 18, 20, 60];
    headers = ['Date', 'Day', 'Work Type', 'Project', 'Start', 'End', 'Hours', 'HH:MM', 'Notes'];
  }
  
  // Ensure total width doesn't exceed available space (257mm)
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
  if (totalWidth > 257) {
    const scaleFactor = 257 / totalWidth;
    colWidths = colWidths.map(width => width * scaleFactor);
  }

  // Header row background
  doc.setFillColor(lightOrangeRgb.r, lightOrangeRgb.g, lightOrangeRgb.b);
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  doc.rect(10, tableStartY - 5, tableWidth, 8, 'F');

  // Header text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  let xPos = 12;
  headers.forEach((header, index) => {
    // Center text in column
    const textWidth = doc.getTextWidth(header);
    const colCenter = xPos + colWidths[index] / 2;
    doc.text(header, colCenter - textWidth / 2, tableStartY);
    xPos += colWidths[index];
  });

  yPos = tableStartY + 8;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  options.data.forEach((row, index) => {
    // Alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(243, 244, 246);
    }
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    doc.rect(10, yPos - 4, tableWidth, 6, 'F');

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
      // Truncate long text to fit column width
      const maxWidth = colWidths[cellIndex] - 3; // Leave some padding
      let cellText = String(cell || '');
      
      // Check if text fits, if not, truncate or wrap
      const textWidth = doc.getTextWidth(cellText);
      if (textWidth > maxWidth) {
        // Try to split text to fit
        const splitText = doc.splitTextToSize(cellText, maxWidth);
        if (splitText.length > 0) {
          cellText = splitText[0];
          // Add ellipsis if text was truncated
          if (splitText.length > 1 && cellText.length > 0) {
            // Remove last few chars and add ellipsis if needed
            if (cellText.length > 3) {
              cellText = cellText.substring(0, cellText.length - 3) + '...';
            }
          }
        } else {
          // Fallback: just truncate
          cellText = cellText.substring(0, Math.floor(maxWidth / 3)) + '...';
        }
      }
      
      // Center-align numeric columns, left-align text columns
      const isNumeric = cellIndex === 6 || cellIndex === 7; // Hours columns
      if (isNumeric && cellText) {
        const textWidth = doc.getTextWidth(cellText);
        const colCenter = xPos + colWidths[cellIndex] / 2;
        doc.text(cellText, colCenter - textWidth / 2, yPos);
      } else {
        doc.text(cellText, xPos + 1, yPos);
      }
      
      xPos += colWidths[cellIndex];
    });

    yPos += 6;

    // New page if needed (leave space for footer)
    if (yPos > 185) {
      doc.addPage();
      yPos = 20;
      
      // Redraw table header on new page
      doc.setFillColor(lightOrangeRgb.r, lightOrangeRgb.g, lightOrangeRgb.b);
      doc.rect(10, yPos - 5, tableWidth, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      xPos = 12;
      headers.forEach((header, headerIndex) => {
        const textWidth = doc.getTextWidth(header);
        const colCenter = xPos + colWidths[headerIndex] / 2;
        doc.text(header, colCenter - textWidth / 2, yPos);
        xPos += colWidths[headerIndex];
      });
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
    }
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageWidth * 0.71, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US')}`, 15, pageWidth * 0.71);
  }

  // Save PDF
  doc.save(filename);
};

