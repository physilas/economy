# NULL — Eine Ökonomie

**[Jetzt spielen → physilas.github.io/economy](https://physilas.github.io/economy/)**

Ein minimalistisches Wirtschaftsspiel für das iPhone. Schwarze Oberfläche, weiße Symbole, ein komplexes System im Hintergrund. Ohne Konto, Werbung, Tracking, Server oder externe Bibliotheken.

## Auf dem iPhone installieren

1. Die Spieladresse in **Safari** öffnen.
2. Auf **„Offline bereit“** warten.
3. **Teilen → Zum Home-Bildschirm → Hinzufügen** wählen.
4. NULL über das neue Symbol öffnen. Vorhandene Safari-Spielstände bei Bedarf über **Spielstände → Exportieren / Importieren** übertragen.
5. Einmal im Flugmodus öffnen, um die lokale Installation zu prüfen.

Updates werden beim Start, bei Rückkehr zur App, bei wiederhergestellter Internetverbindung und zusätzlich alle 15 Minuten gesucht. Eine vollständige neue Version wird im Hintergrund zwischengespeichert. **„Update laden“** sichert den Spielstand und wechselt zur neuen Version. Alte und neue App-Dateien werden nicht gemischt.

## Dein Anfang

Baue einen Holzfäller. Im Markt kannst du bei Holz über **Automatik** „Überschüsse verkaufen“ wählen und die Verkaufsschwelle beispielsweise auf 20 stellen. Erweitere behutsam; Arbeitskräfte und Transport bleiben gemeinsame Engpässe. Liefere Aufträge für zusätzliche Prämien.

Neue Waren, Betriebe, Forschungszweige und Anlageformen bleiben verborgen, bis du sie entdeckst. **ⓘ** erklärt jedes Produkt und seine Regeln. Eine integrierte Spielanleitung hilft bei den ersten Schritten.

## Zeit und Sicherungen

- Eine echte Minute entspricht einer Spielstunde; 24 echte Minuten einem Spieltag.
- Produktion wird jede Sekunde berechnet. Preise bewegen sich alle fünf Sekunden. Die schnellere Darstellung beschleunigt die Wirtschaftsleistung nicht.
- Beim Wiederöffnen werden bis zu **sieben echte Tage je Abwesenheit** nachgerechnet. Engpässe, Ereignisse, Marktaufträge, Zinsen und Fälligkeiten gelten weiter. Darüber hinausgehende Zeit wird im Rückkehrbericht ausgewiesen.
- Autosave alle 15 Sekunden, nach Entscheidungen und beim Verlassen; drei manuelle Speicherplätze, JSON-Export und Import.
- Jeder Speicherplatz besitzt zusätzlich seine letzte gültige Sicherung. Prüfsummen erkennen beschädigte Dateien; eingelesene Daten werden validiert.
- Pro Browser-Speicher ist nur eine Sitzung aktiv. Die andere Sitzung pausiert, damit Fortschritt nicht doppelt berechnet oder überschrieben wird.

Browserdaten sind lokal: Wer sie löscht, verliert auch lokale Spielstände. **Eine exportierte Datei ist die unabhängige Sicherung.** Safari und die Home-Bildschirm-App können getrennte Speicher verwenden.

## Wirtschaft und Entscheidungen

Produktionsketten benötigen Vorprodukte, Personal, Energie, Transport, Lagerplatz und Betriebskapital. Skaleneffekte konkurrieren mit steigenden Baukosten, Knappheit und Umweltkosten. Eine Mengenplanung macht Zulieferdefizite sichtbar. Ein optionaler Margenwächter pausiert offensichtliche Verlustketten und startet sie bei erholten Preisen wieder. Strategien, Ausbaustufen und Forschung verändern die Unternehmensleistung.

**Bau prüfen** öffnet bei jedem bekannten Betrieb eine Vorschau für 1 bis 100 zusätzliche Einheiten. Sie zeigt Baukosten, verbleibende Liquidität, Vorproduktbedarf, technische Auslastung, zusätzliche Infrastruktur und einen Marktvergleich der laufenden Kosten und Erlöse. Vorhandene Zulieferer werden berücksichtigt. Die Vorschau verändert keinen Spielstand und kennt keine zukünftigen Kurse; Rechenannahmen stehen hinter dem Info-Symbol im Dialog. Noch nicht entdeckte Inhalte bleiben verborgen.

Der Markt reagiert auf eigene Handelsmengen, externe Nachfrage, Konjunktur und Ereignisse. Aufträge werden mit einem integrierten marginalen Preiseffekt abgerechnet; Aufteilen eines Auftrags erzeugt keinen kostenlosen Preisvorteil. Automatik und Limitaufträge handeln nach den gesetzten Regeln.

Aktien sind mit Unternehmensfundamentaldaten verknüpft. Verkaufspreise, Inputkosten und Konjunktur bestimmen Umsatz und Marge. Alle fünf Spieltage erscheinen Geschäftsberichte. KGV, Gewinn je Anteil, Dividenden und Modell-Ertragswert erlauben begründete Vergleiche. Kurse schwanken zusätzlich; der Modellwert garantiert keinen Gewinn.

<details>
<summary>Weitere Systeme — mögliche Entdeckungen</summary>

- 33 Ressourcen, 33 Produktionsbetriebe, elf Entwicklungsepochen und 13 Infrastrukturtypen.
- Zwölf Forschungszweige mit mehreren Stufen; vier Unternehmensstrategien, Umweltsystem und Kapazitätsplanung.
- Reservekonto, Tagesgeld, drei Festgeldlaufzeiten, Kontokorrent und amortisierende Investitionskredite.
- Fünf Einzelaktien und ein Marktindex, Dividenden-Wiederanlage und regelmäßige Sparpläne.
- Drei Anleiheklassen, vier riskante Beteiligungsarten und vier vermietete Immobilienarten.
- Call- und Put-Absicherungen mit modellierten Prämien, fester Laufzeit und auf die Prämie begrenztem Verlust. Abrechnung zum Außenmarkt ohne direkt manipulierbaren eigenen Knappheitseffekt.
- Liquiditätsmanager, Lieferverträge, Reputation, Konjunkturzyklen, Ereignisse und Meilensteine.
- Acht aufeinanderfolgende Holdingprogramme mit jeweils drei wählbaren Schwerpunkten: Produktion, Finanzen oder Logistik. Einmalige Material- und Kapitalinvestitionen, feste echte Laufzeiten, dauerhafte Boni. Laufende und abgeschlossene Programme überleben spätere Neugründungen und Sanierungen.
- Dauerhafte Vermächtnispunkte für spätere Neugründungen.
- Notaufträge und bei Überschuldung eine Sanierung als Ausweg. Eine Sanierung gibt Vermögenswerte ab, erhält aber Wissen und Entdeckungen.

</details>

Finanzprodukte und Rechenregeln gehören ausschließlich zur Spielwelt. Die Info-Dialoge zeigen Laufzeiten, Gebühren, Steuerregeln und Risiken, bevor eine Entscheidung getroffen wird.

## Entwicklung und Prüfung

Die App läuft direkt aus `index.html`; ein Build ist nicht nötig. GitHub Pages veröffentlicht `main` aus `/`. Alle URLs sind relativ und unterstützen den Projektpfad `/economy/`.

```sh
npm test
npm run check
npm run test:long
npm run test:month
python3 -m http.server 4187 --bind 127.0.0.1
```

Node.js 22 oder neuer wird für die Tests benötigt, Python nur für eine lokale HTTP-Vorschau. Die App selbst hat keine Paketabhängigkeiten. Der Service Worker benötigt HTTPS oder localhost.

Die Tests prüfen unter anderem deterministische Live-/Offline-Berechnung, Stundenerträge beim Sekundentakt, Konstruktion, Preiswirkung, unmögliche Rückverkaufsgewinne, Kredite, Zinsen, Steuern, Fälligkeiten, Optionsmathematik, Wiederanlage, Immobilien, Berichte, versteckte Freischaltungen, Schema-Validierung, beschädigte Sicherungen und eine simulierte Offline-Woche. GitHub Actions führt die Prüfungen bei jedem Push aus.

Der zusätzliche Langzeittest beginnt mit dem normalen Startkonto und verwendet ausschließlich reguläre Spielaktionen. Ein einfacher Unternehmensmanager baut, schafft Kapazitäten, richtet Handel ein und forscht. Innerhalb von bis zu 14 simulierten echten Tagen müssen die ursprünglichen sieben Epochen und die erste Neugründung erreichbar sein. Es werden weder Geld noch Freischaltungen injiziert. Ein weiterer Test spielt 35 echte Tage nach: neue Epochen und sämtliche Holdingprogramme müssen mit regulären Aktionen erreichbar bleiben. Dabei werden auch neue Infrastruktur, Materialreserven, Schwerpunktwahl und Forschungsbudgets genutzt.

Speicherformat-Version und App-Version sind getrennt. Ergänzte Spielfelder erhalten beim Laden alter Stände sichere Standardwerte. Für App-Dateiänderungen die Release-Version und den Service-Worker-Cache-Namen gemeinsam erhöhen.
