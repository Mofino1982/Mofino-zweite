# Mo‘s Abo – diese Aktualisierung einspielen

Diese Dateien sind vorbereitet und lokal geprüft. Die laufende GitHub-Seite, Firebase und Stripe wurden hierdurch noch nicht verändert.

1. ZIP entpacken. Den gesamten Inhalt von `website` ins GitHub-Hauptverzeichnis hochladen und ersetzen: HTML-Dateien UND den vollständigen Ordner `assets`. Die Bilder sind jetzt separate Dateien. Ein Upload nur von index.html genügt nicht. Pages bleibt main → /(root).
2. Die bisherigen Firestore-Regeln sichern. Dann den vollständigen Inhalt von `backend/firestore.rules` im Firebase-Projekt mo-fino unter Firestore → Regeln einsetzen und veröffentlichen. Die neuen Kontotyp- und Logo-Regeln gehören zusammen mit den neuen Seiten hochgeladen.
3. Admin freigeben: In Firebase Authentication die vollständige UID deines eigenen Admin-Kontos kopieren. In Firestore die Sammlung `admins` anlegen/öffnen. Dokument-ID ist genau diese UID; Feld `active`, Typ Boolean, Wert true. Danach Adminseite neu laden. Kein Passwort und kein Secret in GitHub speichern.
4. Kunden verwenden ein Kundenkonto, Firmen ein getrenntes Firmenkonto mit eigener E-Mail-Adresse. Eine bestätigte E-Mail allein erteilt keine Firmen- oder Adminrechte. Bereits falsch zugeordnete Konten muss der Projektinhaber anhand der bestehenden Daten prüfen; die Seite ändert deren Rolle nicht automatisch.
5. Firma meldet sich im passenden Firmenbereich an und lädt ihr Original-Logo unter „Dein Firmenlogo“ hoch. Der Admin prüft zuerst die Firmenanmeldung und gibt sie frei. Danach unter „Firmenkarten & Logos veröffentlichen“ Betrieb auswählen, Logo und öffentliche Anschrift prüfen und veröffentlichen. Firmenname bleibt als lesbare Beschriftung unter dem Logo erhalten. Ohne Originaldatei steht „Firmenlogo folgt“; es werden keine fremden Logos erfunden.
6. Für Autowäsche echte Firmen und gültige Angebote im Admin freigeben. Solange keine Angebote veröffentlicht sind, wird kein buchbares Paket vorgetäuscht. Guthaben wird erst nach bestätigter Zahlung freigeschaltet.
7. Stripe benötigt zusätzlich die Einrichtung aus README.md (Secrets, Cloud Functions, Webhook, zunächst Testmodus). Ein GitHub-Upload verbindet kein Stripe-Konto. Die Integration ist vorbereitet; sie wurde nicht live bereitgestellt oder mit einer echten Zahlung geprüft.

Enthalten: getrennte Kunden-/Firmenrechte, Logoupload mit Adminprüfung, veröffentlichte Partnerkarten für Café und Autowäsche, ausgelagerte Bilder, neues Café-Innenraumbild statt Logo in der Galerie, Entfernung markierter technischer Kundentexte, Adminzugang-Hilfe und Passwortzurücksetzen. Restaurant ersetzt Bowling; weitere Abos folgen.

Prüfung: 42 Anmelde-/Einlösungs-/Stripe-Tests sowie 8 Firestore-Regeltests bestanden. Alle eingebetteten JavaScript-Dateien wurden auf Syntax und lokale Bildverweise auf Existenz geprüft. Keine Browser- oder Livekontoprüfung durchgeführt.
