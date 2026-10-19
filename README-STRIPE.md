# Mo‘s Abo – Stripe Checkout & automatische Freischaltung

Vorbereitet, lokal geprüft, noch nicht mit deinem Stripe-Konto verbunden und nicht bereitgestellt.

## Was enthalten ist

- website/: aktuelle Hauptseite und getrennte Member-/Firmen-/Adminseiten, Stripe-Bezahlbuttons für Café und Autowäsche, zahlung.html als Rückkehr- und Statusseite.
- backend/: vorhandene Café-Einlösung plus Stripe-Checkout, signierter Webhook, eigener Zahlungsstatus und Stripe-Kundenportal.
- Zahlungsbelege erscheinen im zentralen und in den Bereichsadmins. Kundenguthaben wird erst durch eine verifizierte, vollständig bezahlte Monatsrechnung erneuert.
- Testzahlungen sind ausdrücklich isoliert: keine echten Getränke, Wäschen oder Bonusmonate.
- Autowäsche: 24,90 / 34,90 / 54,90 Euro; 2 / 3 / 5 Monatswäschen; automatische Erfassung der bestätigten Monatszahlungen für 6-/12-Monats-Boni.
- Café: Basic 20 Euro / 8, Standard 35 Euro / 16, Premium 60 Euro / 30, Mittagsmoment 10 Euro, Coworking 29,90 Euro. Die vorhandenen Tarifleistungen bleiben maßgeblich. Es wurden keine neuen Geschenke oder Konditionen erfunden.

## 1. Server und Stripe zuerst im Testmodus einrichten

Ein GitHub-Upload allein kann keine Zahlungen verifizieren. Dafür sind die mitgelieferten Firebase Cloud Functions nötig. Das vorhandene kostenlose Spark-Projekt kann eine kostenpflichtige Tarifumstellung auf Blaze benötigen. Eine solche Umstellung wurde nicht ausgeführt; mögliche Hosting-/Secret-Manager-Kosten vorab prüfen.

1. Stripe-Konto öffnen, Testmodus wählen. Den Secret Key direkt im eigenen Firebase Secret Manager hinterlegen, niemals in HTML, GitHub oder Chatnachrichten.
2. Mit einem berechtigten Firebase-CLI-Zugang im Ordner backend anmelden. Node 22 verwenden. Im Unterordner functions npm ci und npm test ausführen.
3. Aus backend die Secrets setzen (die CLI fragt die Werte verdeckt ab):

```sh
firebase functions:secrets:set STRIPE_SECRET_KEY --project mo-fino
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project mo-fino
```

STRIPE_SECRET_KEY zunächst sk_test_… . STRIPE_WEBHOOK_SECRET ist das whsec_… des passenden Test-Webhooks. Den Webhook dafür im Stripe-Dashboard mit der erwarteten Firebase-URL anlegen; dieser ist erst nach Bereitstellung erreichbar. Secretwerte nicht als Kommandoargument, im Repository oder im Browser-Code speichern.

4. Im Stripe-Dashboard einen Snapshot-Webhook in der API-Version 2025-06-30.basil anlegen. Erwartete Firebase-URL:

https://europe-west3-mo-fino.cloudfunctions.net/stripeWebhook

Die tatsächliche URL nach Bereitstellung mit der ausgegebenen Function-URL abgleichen. Ereignisse:

- invoice.paid
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted
- checkout.session.expired

5. Im Stripe-Kundenportal Kündigungen zulassen und Tarifwechsel deaktivieren. Die automatische Guthabenzuteilung unterstützt die festgelegten Monatsabos, keine Mengen-, Preis-, Rabatt- oder Tarifwechsel im Portal. In Stripe einen gültigen öffentlichen Link zu den fertigen Abo-Bedingungen hinterlegen; Checkout verlangt die Zustimmung.
6. Die vorhandenen Firestore-Regeln sichern/abgleichen, dann aus backend die ergänzten Regeln und ausschließlich die neuen Functions bereitstellen:

```sh
firebase deploy --only firestore:rules --project mo-fino
firebase deploy --only functions:createStripeCheckout,functions:stripeWebhook,functions:getStripeStatus,functions:createStripePortal --project mo-fino
```

MO_PUBLIC_BASE_URL muss die tatsächliche Website-Basis inklusive abschließendem Schrägstrich enthalten, zunächst https://mofino1982.github.io/Mofino-zweite/ . Keine Zahlungsrückkehr-URL aus Browsereingaben wird übernommen.

7. In der Firebase-Konsole das Dokument billingSettings/main anlegen:

```json
{
  "enabled": true,
  "mode": "test",
  "termsVersion": "stripe-2026-10-19",
  "coffeeEnabled": true,
  "washPartnerPricesConfirmed": true
}
```

Diese Flags erst setzen, wenn die tatsächlichen Abo-Bedingungen bzw. Waschpartnerpreise (5 Euro Basiswäsche / 50 Euro Basis-Aufbereitung) bestätigt sind. In Firestore sind enabled, coffeeEnabled und washPartnerPricesConfirmed echte boolean-Werte, keine Texte. Restaurant bleibt ohne Zahlungsangebot.

## 2. Website hochladen

Den INHALT von website/ in das vorhandene GitHub-Hauptverzeichnis von Mofino1982/Mofino-zweite hochladen. Gleichnamige HTML-Dateien ersetzen; assets als gleichnamigen Ordner behalten. Nicht den Ordner website als zusätzliches Verzeichnis hochladen. Pages bleibt main → /(root).
backend/ daneben im Repository ist nur Quellcode; die Firebase-Bereitstellung aus Schritt 1 bleibt erforderlich.

## 3. Testen

- Mit einer bestätigten Kunden-E-Mail anmelden und einen Tarif wählen.
- Mit einer offiziellen Stripe-Testkarte den Checkout abschließen. In zahlung.html muss TEST angezeigt werden; es darf kein echtes Guthaben entstehen.
- Erfolgreichen Testbeleg im Admin prüfen. Zahlung abbrechen und eine abgelehnte Testkarte prüfen: kein Guthaben.
- Dasselbe Webhook-Ereignis erneut senden: kein zweiter Beleg/Guthabenzuwachs.
- Nach einer echten Live-Zahlung: Abo aktiv, richtige Anzahl, Gültigkeit bis Ende des bezahlten Stripe-Zeitraums. Verlängerungsrechnung genau einmal verarbeiten.
- Zahlungsausfall: keine neue Monatsfreigabe. Das bisher bezahlte Guthaben läuft spätestens zum gespeicherten Ende aus. Kündigung zum Laufzeitende erneuert nicht; ein beendetes/unbezahltes Abo wird gesperrt.

## 4. Live aktivieren

Erst nach erfolgreichem End-to-End-Test und fertigen öffentlichen Bedingungen die Live-Keys und das Live-Webhook-Secret im Secret Manager setzen und Functions neu bereitstellen. billingSettings/main.mode auf live ändern. Testabos vorher im Stripe-Testdashboard beenden. Stripe-Test- und Live-Objekte nicht mischen.
Keine Live-Zahlung und kein Hosting-Tarifwechsel wurde durch dieses Paket ausgeführt.

## Grenzen und bestehende Konten

Aktive manuelle Abos und vorhandene Autowäsche-Bonusverträge werden nicht automatisch überschrieben. Für deren Wechsel zu Stripe ist eine bewusste Migration nötig. Diese Fassung blockiert doppelte aktive Abos und schützt vorhandene Bonusstände.
Stripe ist hier der Zahlungsdienst für das Plattform-Abo. Es handelt sich nicht um Stripe Connect und nicht um automatische Auszahlungen an Partnerfirmen; deren Abrechnung bleibt im Admin.
Erstattungen/Rückbuchungen erfordern zusätzlich die administrative Prüfung bereits eingelöster Leistungen und Bonusstände. Das Paket führt keine automatischen Erstattungen aus. Betreiberangaben, Widerruf, Kündigung, Preise und Gutscheinbedingungen müssen vor dem Live-Verkauf fertig sein.
Die Firebase-Projektkennung und bestehenden QR-Protokolle wurden zur Kompatibilität beibehalten.

## Technische Prüfung

15 lokale Stripe-Logik-/Ablauftests: Signaturen, fehlende Zahlung, falscher Preis, doppelte Events, doppelte Rechnungszeiträume, verspätete Ereignisse, Freischaltung, Testisolierung, Bonuszählung, Kündigung und gefälschte Rückkehr.
4 zusätzliche Firestore-Regeltests: Kunden können weder Zahlungseingang noch Serverdaten fälschen; Zahlungsübersicht nur Admin.
Skripte und interne Dateiverweise der erzeugten HTML-Dateien wurden geprüft. Kein echter Stripe-/Firebase-Livetest und kein Browser-Test durchgeführt.

Offizielle Grundlagen:
https://docs.stripe.com/billing/subscriptions/webhooks
https://docs.stripe.com/webhooks
https://docs.stripe.com/api/checkout/sessions/create
https://firebase.google.com/docs/functions/config-env
