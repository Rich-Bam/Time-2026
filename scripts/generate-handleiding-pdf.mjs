/**
 * Generate Handleiding_Weekly_Only.pdf for invitation emails (weekly_only users).
 * Run: npm run generate-handleiding
 * Output: public/Handleiding_Weekly_Only.pdf
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsPDFModule from "jspdf";
const jsPDF = jsPDFModule.default ?? jsPDFModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "public", "Handleiding_Weekly_Only.pdf");

const ORANGE = { r: 234, g: 88, b: 12 }; // #EA580C

function addHeader(doc, title) {
  doc.setFillColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("BAMPRO MARINE – Timesheet System", 105, 14, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(title, 105, 22, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

const PDF_TITLE = "Handleiding: Uren invullen (Weekly Only – Eenvoudige weergave)";

function wrapText(doc, text, maxWidth) {
  const lines = doc.splitTextToSize(text, maxWidth);
  return lines;
}

function addParagraph(doc, text, opts) {
  const { x = 15, y, maxWidth = 180, lineHeight = 6, font = "helvetica", fontSize = 10 } = opts || {};
  doc.setFont(font, "normal");
  doc.setFontSize(fontSize);
  const lines = wrapText(doc, text, maxWidth);
  let currentY = y;
  for (const line of lines) {
    if (currentY > 275) {
      doc.addPage();
      addHeader(doc, PDF_TITLE);
      currentY = 36;
    }
    doc.text(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function addHeading(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.text(text, 15, y);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

function addFooter(doc, pageNum, totalPages) {
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Pagina ${pageNum} van ${totalPages} – BAMPRO MARINE Timesheet System`,
    105,
    290,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
}

const content = [
  {
    heading: "1. Inloggen",
    body: "Eerste keer: klik in de uitnodigingsmail op \"Activeer je account\", stel een wachtwoord in en bevestig. Log daarna in op de website met je e-mailadres en wachtwoord. Volgende keren: ga naar de website en log in met e-mail en wachtwoord.",
  },
  {
    heading: "2. Navigatie (eenvoudige weergave)",
    body: "Je ziet: Wekelijkse Invoer (uren per week invullen), Overuren, Projecten, Rapporteer Bug, Overzicht. Rechts: thema, taal, je naam, Uitloggen. Het tabblad Ingevulde uren en Exporteren zijn niet beschikbaar; je kijkt uren terug via Wekelijkse Invoer (andere week) of Overzicht. Op de wekelijkse pagina kun je wel \"Exporteer week naar Excel\" gebruiken.",
  },
  {
    heading: "3. Wekelijkse Invoer – week kiezen",
    body: "Bovenaan staat Week X met maandag t/m zondag. Gebruik Vorige/Volgende. Op desktop: \"Selecteer week\" om een week te kiezen waarin je al uren hebt (alleen die weken staan in de lijst). Standaard opent de huidige week.",
  },
  {
    heading: "4. Wekelijkse Invoer – per dag invullen",
    body: "Werk type: kies bijv. Werk, Productie, Thuis-werk, Vrije dag/vakantie, Ziek; bij de meeste types een project (zoeken of nieuw aanmaken via zoekveld + Enter). Start en Eind: vul tijden in (uren worden automatisch berekend). Hele dag vrij (8 uren): bij vrije dag/vakantie aanvinken. Overnachting: aanvinken als je niet thuis hebt geslapen. Bij Thuis-werk/Werk-werk: eventueel kilometers invullen. Meerdere regels per dag: \"Voeg invoer toe\", vul in, klik \"Dag opslaan\". \"Kopieer vorige\" neemt de vorige dag over.",
  },
  {
    heading: "5. Week bevestigen",
    body: "Vul alle werkdagen (ma–vr) in. Klik \"Week bevestigen\". Na bevestiging is de week vergrendeld; wijzigingen kunnen alleen door een beheerder worden gedaan. Daarna kun je de week per e-mail naar administratie sturen of \"Exporteer week naar Excel\" gebruiken om lokaal op te slaan of te printen.",
  },
  {
    heading: "6. Vrije dagen en overuren",
    body: "Vrije dagen over: op de wekelijkse pagina staat een teller (25 dagen/jaar); het systeem toont hoeveel je nog over hebt. Overuren: samenvatting op de wekelijkse pagina en volledig overzicht in het tabblad Overuren (125%, 150%, 200% en overnachtingen).",
  },
  {
    heading: "7. Overzicht",
    body: "Via Overzicht bekijk je je eigen uren. Je kunt filteren op periode of dag. Alleen jouw eigen uren zijn zichtbaar.",
  },
  {
    heading: "8. Veiligheid (RLS)",
    body: "Je gegevens worden opgeslagen onder RLS (Row Level Security). Alleen jouw uren zijn voor jou zichtbaar en bewerkbaar.",
  },
  {
    heading: "9. Korte samenvatting",
    body: "Week kiezen: Vorige/Volgende of Selecteer week. Per dag: werk type, project (indien nodig), start/eind; eventueel Hele dag vrij, Overnachting, kilometers. Voeg invoer toe voor meerdere regels; Dag opslaan. Week bevestigen → vergrendeld; daarna eventueel e-mail of Exporteer week naar Excel. Terugkijken: andere week of Overzicht.",
  },
  {
    heading: "10. Hulp",
    body: "Link verlopen? Vraag je beheerder om een nieuwe uitnodiging. Wachtwoord vergeten of technische problemen? Neem contact op met je beheerder of het BAMPRO MARINE Timesheet-beheer.",
  },
];

function main() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  addHeader(doc, PDF_TITLE);
  let y = 36;

  for (const section of content) {
    if (y > 250) {
      doc.addPage();
      addHeader(doc, PDF_TITLE);
      y = 36;
    }
    y = addHeading(doc, section.heading, y);
    y = addParagraph(doc, section.body, { y, lineHeight: 5.5 }) + 6;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  const buffer = doc.output("arraybuffer");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log("Written:", outputPath);
}

main();
