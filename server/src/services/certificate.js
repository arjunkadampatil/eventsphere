const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const INDIGO = rgb(79 / 255, 70 / 255, 229 / 255);
const CYAN = rgb(6 / 255, 182 / 255, 212 / 255);
const SLATE_900 = rgb(15 / 255, 23 / 255, 42 / 255);
const SLATE_500 = rgb(100 / 255, 116 / 255, 139 / 255);

function centered(page, text, font, size, y, color) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

// Shrinks long names/titles until they fit inside the certificate margins.
function fitSize(font, text, maxSize, maxWidth) {
  let size = maxSize;
  while (size > 10 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

async function renderCertificate({ studentName, eventTitle, clubName, date, ticketCode }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate - ${eventTitle}`);
  pdf.setAuthor('EventSphere');
  const page = pdf.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: height - 14, width, height: 14, color: INDIGO });
  page.drawRectangle({ x: 0, y: 0, width, height: 6, color: CYAN });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 70,
    borderColor: rgb(0.89, 0.91, 0.94),
    borderWidth: 1.5,
  });

  centered(page, 'EVENTSPHERE', bold, 14, height - 90, INDIGO);
  centered(page, 'Certificate of Participation', bold, 34, height - 150, SLATE_900);
  centered(page, 'This is to certify that', regular, 14, height - 205, SLATE_500);
  centered(page, studentName, bold, fitSize(bold, studentName, 40, width - 160), height - 260, SLATE_900);
  page.drawLine({
    start: { x: width / 2 - 180, y: height - 275 },
    end: { x: width / 2 + 180, y: height - 275 },
    thickness: 1,
    color: CYAN,
  });
  centered(page, 'participated in', regular, 14, height - 310, SLATE_500);
  centered(page, eventTitle, bold, fitSize(bold, eventTitle, 24, width - 160), height - 345, INDIGO);
  const when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(date);
  centered(page, `organised by ${clubName} on ${when}`, regular, 13, height - 375, SLATE_500);

  page.drawText(`Verification code: ${ticketCode}`, { x: 56, y: 56, size: 9, font: regular, color: SLATE_500 });
  page.drawText('Issued by EventSphere', { x: width - 175, y: 56, size: 9, font: regular, color: SLATE_500 });

  return Buffer.from(await pdf.save());
}

module.exports = { renderCertificate };
