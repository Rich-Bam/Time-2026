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
      addHeader(doc, "Handleiding: Uren invullen (Weekly Only)");
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
    heading: "1. Inloggen na uitnodiging",
    body: "1. Klik in de uitnodigingsmail op \"Activeer je account\" (of op de link in de mail).\n2. Stel een wachtwoord in en bevestig dit.\n3. Log daarna in met je e-mailadres en het gekozen wachtwoord op de website van het BAMPRO MARINE Timesheet System.",
  },
  {
    heading: "2. Wat zie je na het inloggen?",
    body: "Je komt op het scherm \"Wekelijkse Invoer\". In de navigatie zie je o.a.: Wekelijkse Invoer (hier vul je je uren per week in), Overuren (overzicht van je overuren), Overzicht (algemeen overzicht). Verder zie je rechts o.a. thema, taal, je naam en Uitloggen.",
  },
  {
    heading: "3. Uren invullen – stap voor stap",
    body: "3.1 Juiste week kiezen\nBovenaan staat Week X met het datumbereik (maandag t/m zondag). Gebruik \"Vorige\" / \"Volgende\" om een week terug of vooruit te gaan. Op desktop kun je via \"Selecteer week\" een week kiezen waarin je al uren hebt ingevuld. Standaard opent de huidige week.\n\n3.2 Per dag uren invullen\nVoor elke dag (maandag t/m zondag) kun je één of meer regels invullen:\n• Werk type: kies het type werk (bijv. Werk, Productie, Thuis-werk, Vrije dag/vakantie, Ziek). Sommige types vereisen geen project.\n• Project: bij de meeste werktypes moet je een project kiezen.\n• Starttijd en eindtijd: vul Start (bijv. 08:00) en Eind (bijv. 17:00) in. De uren worden automatisch berekend.\n• Hele dag vrij: voor vrije dagen/vakantie kun je \"Hele dag vrij (8 uren)\" aanvinken.\n• Meerdere regels per dag: via \"Voeg invoer toe\" voeg je extra regels toe op dezelfde dag.\n• Sla je wijzigingen op (per regel/dag).\n\n3.3 Week bevestigen\nAls alle werkdagen (maandag–vrijdag) zijn ingevuld, klik je op \"Week bevestigen\". Na bevestiging is de week vergrendeld: je kunt dan geen uren meer wijzigen. Na bevestigen kun je vaak nog kiezen om de week per e-mail naar administratie te sturen.",
  },
  {
    heading: "4. Uren terugkijken",
    body: "Gebruik \"Vorige\" / \"Volgende\" om week voor week te bladeren. Via \"Selecteer week\" kies je een week uit de dropdown (alleen weken waarin je al uren hebt, worden getoond). Je kunt een week ook \"Exporteer week naar Excel\" om uren op te slaan of te printen. Je hebt geen apart tabblad Ingevulde uren; je kijkt alles terug via het Wekelijkse Invoer-scherm door van week te wisselen.",
  },
  {
    heading: "5. Veiligheid van je gegevens (RLS)",
    body: "Alle gegevens die je invult worden opgeslagen onder een RLS-beleid (Row Level Security). RLS betekent dat op databaseniveau regels gelden over wie welke rijen mag zien en wijzigen. Jouw uren en gegevens zijn gekoppeld aan jouw account; het systeem zorgt ervoor dat je alleen je eigen uren ziet en kunt beheren. Dit waarborgt de vertrouwelijkheid en integriteit van je gegevens.",
  },
  {
    heading: "6. Korte samenvatting",
    body: "Week kiezen: Vorige/Volgende of Selecteer week.\nUren invullen: per dag werk type, project (indien nodig), start- en eindtijd; eventueel Hele dag vrij.\nWeek afronden: Week bevestigen – daarna is de week vergrendeld.\nTerugkijken: zelfde scherm; andere week kiezen of exporteren naar Excel.\nGegevens: opgeslagen onder RLS-beleid; alleen jouw gegevens zijn voor jou zichtbaar en bewerkbaar.",
  },
  {
    heading: "7. Hulp",
    body: "Link verlopen? Vraag je beheerder om een nieuwe uitnodiging. Wachtwoord vergeten of technische problemen? Neem contact op met je beheerder of het BAMPRO MARINE Timesheet-beheer.",
  },
];

function main() {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  addHeader(doc, "Handleiding: Uren invullen (Weekly Only)");
  let y = 36;

  for (const section of content) {
    if (y > 250) {
      doc.addPage();
      addHeader(doc, "Handleiding: Uren invullen (Weekly Only)");
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
