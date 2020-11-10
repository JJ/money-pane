/*   Money Pane
 **
 **  A ledger consists a of a series of transactions.
 */

import { v4 as uuidv4 } from 'uuid'
import { icons, ns, solidLogicSingleton } from 'solid-ui'
import { st } from 'rdflib'
import { fileUploadButtonDiv } from 'solid-ui/lib/widgets/buttons'
import { parseAsnCsv } from './parsers/asnbank-csv'

ns.halftrade = (label: string) => `https://ledgerloops.com/vocab/halftrade#${label}`
ns.money = (tag: string) => `https://example.com/#${tag}` // @@TBD

const mainClass = ns.halftrade('Ledger')
const LEDGER_LOCATION_IN_CONTAINER = 'index.ttl#this'

function generateTable(halfTrades: HalfTrade[]) {
  let str = '<table><tr><td>Date</td><td>From</td><td>To</td><td>Amount</td><td>Description</td>\n'
  halfTrades.forEach(halfTrade => {
    str += `<tr><td>${halfTrade.date}</td><td>${halfTrade.fromId}</td><td>${halfTrade.toId}</td><td>${halfTrade.amount} ${halfTrade.unit}</td><td>${halfTrade.description}</td></tr>\n`
  })
  return str + '</table>\n'
}

async function importCsvFile(text: string, graph: string): Promise<void> { 
  let str = '<table><tr><td>Date</td><td>From</td><td>To</td><td>Amount</td><td>Description</td>\n'
  // TODO: Support more banks than just ASN Bank
  const halfTrades = parseAsnCsv(text)
  const ins = []
  halfTrades.forEach(halfTrade => {
    str += `<tr><td>${halfTrade.date}</td><td>${halfTrade.fromId}</td><td>${halfTrade.toId}</td><td>${halfTrade.amount} ${halfTrade.unit}</td><td>${halfTrade.description}</td></tr>\n`
    console.log(halfTrade)
    const sub = uuidv4()
    ins.push(st(sub, ns.rdf('type'), ns.halftrade('HalfTrade'), graph))
    const fields = [ 'date', 'from', 'to', 'amount', 'unit', 'impliedBy', 'description' ]
    fields.forEach((field: string) => {
      ins.push(st(sub, ns.halftrade(field), halfTrade[field], graph))
    })
  })
  console.log(`Imported ${ins.length} triples, patching your ledger`)
  await solidLogicSingleton.updatePromise([], ins)
  console.log('done')
}

export const MoneyPane = {
  icon: 'noun_Trade_1585569.svg', // Trade by bezier master from the Noun Project
  name: 'Personal Finance',
  label (subject, context) {
    const kb = context.session.store
    if (kb.holds(subject, ns.rdf('type'), mainClass)) {
      return 'Ledger'
    }
    return null // Suppress pane otherwise
  },

  mintClass: mainClass,

  mintNew: function (context, newPaneOptions) {
    const kb = context.session.store
    var updater = kb.updater
    if (newPaneOptions.me && !newPaneOptions.me.uri) {
      throw new Error('money mintNew:  Invalid userid ' + newPaneOptions.me)
    }

    var newInstance = (newPaneOptions.newInstance =
      newPaneOptions.newInstance ||
      kb.sym(newPaneOptions.newBase + LEDGER_LOCATION_IN_CONTAINER))
    var newLedgerDoc = newInstance.doc()

    kb.add(newInstance, ns.rdf('type'), mainClass, newLedgerDoc)
    kb.add(newInstance, ns.dc('title'), 'Ledger', newLedgerDoc)
    kb.add(newInstance, ns.dc('created'), new Date(), newLedgerDoc)
    if (newPaneOptions.me) {
      kb.add(newInstance, ns.dc('author'), newPaneOptions.me, newLedgerDoc)
    }

    return new Promise(function (resolve, reject) {
      updater.put(
        newLedgerDoc,
        kb.statementsMatching(undefined, undefined, undefined, newLedgerDoc),
        'text/turtle',
        function (uri2, ok, message) {
          if (ok) {
            resolve(newPaneOptions)
          } else {
            reject(
              new Error(
                'FAILED to save new ledger at: ' + uri2 + ' : ' + message
              )
            )
          }
        }
      )
    })
  },

  render: function (subject, context: { dom: HTMLDocument }, paneOptions: {}) {
    const dom = context.dom
    // const kb = context.session.store
    const paneDiv = dom.createElement('div')
    const listDiv = dom.createElement('div')
    const uploadButton = fileUploadButtonDiv(document, (files) => {
      if (files.length === 1) {
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
          importCsvFile(event.target.result.toString(), subject);
        });
        reader.readAsText(files[0]);
      } else {
        window.alert('hm');
      }
    })
    paneDiv.innerHTML='<h2>under construction</h2><p>Upload a .csv file from your bank. Currently only <a href="https://asnbank.nl">ASN Bank</a>\'s csv format is supported.</p>'
    paneDiv.appendChild(uploadButton)
    paneDiv.appendChild(listDiv)
    return paneDiv
  }
}
