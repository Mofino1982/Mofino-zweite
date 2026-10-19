from pathlib import Path
from lxml import html, etree
import shutil,json,re,subprocess,zipfile

root=Path('/workspace/scratch/4b371644c17f')
source=root/'output/Mo-s-Abo-GitHub'
out=root/'output/Mo-s-Abo-Stripe'
site=out/'website'
site.mkdir(parents=True,exist_ok=True)
shutil.copytree(source/'backend',out/'backend',dirs_exist_ok=True)
shutil.copytree(source/'docs',site,dirs_exist_ok=True)
config={'apiKey':'AIzaSyDybfM0XPrpohdWvZF8X8xgP3mdCo6OuzI','authDomain':'mo-fino.firebaseapp.com','projectId':'mo-fino','appId':'1:279668714255:web:6ca341d3d6e3a472d5ec7a'}
admin_names=['admin.html','cafe-admin.html','autowaschen-admin.html']
customer_names=['cafe.html','cafe-kunden.html','autowaschen.html','autowaschen-kunden.html']
template='''<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mo‘s Abo · Zahlungsstatus</title><style>body{margin:0;background:#0c0d10;color:#f5f0e7;font:17px/1.7 system-ui}main{max-width:700px;margin:8vh auto;padding:30px;border:1px solid #d8b47c66;border-radius:20px}h1{font:44px Georgia,serif;color:#e2bc7c}a{color:#e2bc7c}button{padding:14px;font:inherit;border-radius:9px;background:#e2bc7c;border:0} [hidden]{display:none!important}</style><main><a href="member.html">← Zu meinem Konto</a><h1>Dein Zahlungsstatus.</h1><p id="moStripeStatus" role="status">Zahlung wird geprüft …</p><a id="moStripeResult" href="member.html" hidden>Zu meinen Angeboten →</a><p><button id="moStripePortal" type="button">Abo verwalten / kündigen</button></p></main></html>'''
template=template.replace('<html lang="de">','<html lang="de"><head>').replace('</style><main>','</style></head><body><main>').replace('</main></html>','</main></body></html>')
(site/'zahlung.html').write_text(template)

def terms(id):
    return html.fragment_fromstring('<label class="mo-stripe-terms" style="display:flex;gap:12px;align-items:flex-start;font:14px/1.6 system-ui;margin:16px 0"><input id="'+id+'" type="checkbox" style="width:22px;height:22px;flex:0 0 22px;accent-color:#e2bc7c"><span>Ich möchte das gewählte monatliche Abo abschließen und akzeptiere die <a href="agb.html" target="_blank" rel="noopener">Abo- und Vermittlungsbedingungen</a>. Preis und wiederkehrende Zahlung bestätige ich anschließend bei Stripe.</span></label>')

for path in site.glob('*.html'):
    d=html.document_fromstring(path.read_text());name=path.name
    if name in customer_names:
        for e in d.xpath('//text()[not(ancestor::style) and not(ancestor::script)]'):
            if 'Zahlung per Überweisung: Wähle im Kundenbereich deinen Tarif' in str(e):
                parent=e.getparent()
                if e.is_tail:parent.tail='Mit Stripe bezahlen: Dein Abo wird nach bestätigter Zahlung automatisch freigeschaltet.'
                else:parent.text='Mit Stripe bezahlen: Dein Abo wird nach bestätigter Zahlung automatisch freigeschaltet.'
        for disabled in d.xpath('//button[@disabled]'):
            if 'Zur Zahlung' in disabled.text_content():
                disabled.attrib.pop('disabled',None);disabled.set('id','moStripePay');disabled.set('type','button');disabled.text='Mit Stripe abonnieren →'
                disabled.getparent().insert(disabled.getparent().index(disabled),terms('moStripeTerms'))
        plan=d.xpath('//*[@id="requestedPlan"]')
        if plan:
            parent=plan[0].getparent()
            parent.append(terms('moStripeMemberTerms'))
            b=etree.SubElement(parent,'button',id='moStripeMemberPay',type='button',attrib={'class':'btn gold'});b.text='Gewählten Tarif mit Stripe abonnieren →'
        if name.startswith('autowaschen'):
            for script in d.xpath('//script'):
                text=script.text or ''
                start=text.find("el.append(button('Paket anfragen',async()=>{")
                end=text.find('list.append(el)}}',start)
                if start>=0 and end>start:
                    text=text[:start]+'''el.append(button('Mit Stripe abonnieren',async()=>{requireUser();if(!confirm('Monatliches Abo „'+offer.name+'“ für '+money(offer.priceCents)+' pro Monat über Stripe abschließen? Die Abo- und Vermittlungsbedingungen gelten. Preis und Zahlung bestätigst du anschließend bei Stripe.'))return;if(typeof window.moStripeCheckout!=='function')throw Error('Zahlungsmodul wird noch geladen. Bitte erneut versuchen.');await window.moStripeCheckout({category:'carwash',offerId:offer.id})}));'''+text[end:]
                    script.text=text
        notice=etree.SubElement(d.find('body'),'section',attrib={'class':'wrap','style':'padding:20px;max-width:1100px;margin:auto'})
        etree.SubElement(notice,'p',id='moStripeStatus',role='status').text='Stripe: Monatsabo mit automatischer Freischaltung nach bestätigter Zahlung.'
        etree.SubElement(notice,'a',href='zahlung.html?bereich='+('coffee' if name.startswith('cafe') else 'carwash')).text='Zahlungsstatus / Abo verwalten →'
    if name in customer_names+['zahlung.html']:
        code=(root/'mo-github/stripe-client.js').read_text().replace('__CONFIG__',json.dumps(config)).replace('__CATEGORY__',json.dumps('coffee' if name.startswith('cafe') else 'carwash'))
        if name=='zahlung.html':code=code.replace('||"carwash"','||new URLSearchParams(location.search).get("bereich")')
        etree.SubElement(d.find('body'),'script',type='module').text=code
    if name in admin_names:
        panel=html.fragment_fromstring('<section id="stripeAdmin" class="card" hidden><h2>Stripe-Zahlungen</h2><p>Nur bestätigte Rechnungen aktivieren ein Live-Abo. TEST-Belege erzeugen kein echtes Guthaben.</p><button type="button" id="stripeRefresh">Zahlungen aktualisieren</button><div id="stripePayments"></div></section>')
        d.xpath('//main')[0].insert(0,panel)
        etree.SubElement(d.find('body'),'script',type='module').text=(root/'mo-github/stripe-admin.js').read_text().replace('__CONFIG__',json.dumps(config))
    path.write_text('<!doctype html>'+etree.tostring(d,encoding='unicode',method='html'))

backend=out/'backend'
for name in ['stripe-functions.cjs','stripe-logic.cjs']:
    shutil.copy2(root/'mo-github'/name,backend/'functions'/name)
# Tests import the same implementation with Firebase/Stripe adapters mocked.
shutil.copy2(root/'mo-github/stripe.test.cjs',backend/'functions/stripe.test.cjs')
index=backend/'functions/index.js'
(backend/'functions/coffee-functions.cjs').write_text(index.read_text())
index.write_text("'use strict';\nObject.assign(exports,require('./coffee-functions.cjs'));\nObject.assign(exports,require('./stripe-functions.cjs'));\n")
regression=backend/'functions/redemption.test.cjs'
regression.write_text(regression.read_text().replace("fs.readFileSync(__dirname+'/index.js'", "fs.readFileSync(__dirname+'/coffee-functions.cjs'"))
rules=backend/'firestore.rules';text=rules.read_text();deny='    match /{document=**} { allow read, write: if false; }'
assert deny in text
blocks='\n'.join('    match /'+collection+'/{id} { allow read: if admin(); allow write: if false; }' for collection in ['billingAccounts','billingOrders','billingInvoices','billingCycles','billingFailures','billingSettings'])
rules.write_text(text.replace(deny,blocks+'\n'+deny))
# Public backend default deny is kept: billing writes occur only through Admin SDK.
for page in site.glob('*.html'):
    d=html.fromstring(page.read_text());ids=d.xpath('//*[@id]/@id');assert len(ids)==len(set(ids)),page.name
    for script in d.xpath('//script[not(@src)]'):
        target=root/'mo-github/stripe-syntax.mjs';target.write_text(script.text or '')
        check=subprocess.run(['node','--check',str(target)],capture_output=True,text=True);assert check.returncode==0,(page.name,check.stderr)
    for anchor in d.xpath('//a[@href]'):
        href=anchor.get('href')
        if href.startswith(('https:','http:','data:','mailto:','tel:','#')):continue
        assert (site/href.split('?')[0].split('#')[0]).exists(),(page.name,href)
print('Stripe: Website-Skripte, Links, getrennte Rollen und serverseitige Abrechnung vorbereitet.')
