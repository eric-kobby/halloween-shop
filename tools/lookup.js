#!/usr/bin/env node
/**
 * Command line front end for the same RDAP lookup the page runs.
 *
 *   node tools/lookup.js xeng@bitovi.com
 *   node tools/lookup.js --json bitovi.com
 *   node tools/lookup.js --demo candy-corp.example
 *
 * Node reaches the registries directly, so unlike the browser this is not
 * subject to CORS - ccTLD servers that reject browser requests work here.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
for (const file of ['helpers/domainHelper.js', 'fixtures/rdap-samples.js', 'services/Rdapservice.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const demo = args.includes('--demo');
const input = args.find((arg) => !arg.startsWith('--'));

if (!input) {
  console.error('usage: node tools/lookup.js [--json] [--demo] <email or domain>');
  process.exit(2);
}

const line = (label, value) => {
  if (value === null || value === undefined || value === '' ||
    (Array.isArray(value) && !value.length)) return;
  console.log(`  ${label.padEnd(14)} ${Array.isArray(value) ? value.join(', ') : value}`);
};

function report(result) {
  const { query, profile, network, notes } = result;

  console.log('');
  console.log(`  ${query.raw}  ->  ${query.domain}`);
  console.log('');

  if (!profile) {
    console.log('  No RDAP record was returned.');
  } else {
    console.log(`  COMPANY        ${profile.companyName || '(not published)'}`);
    line('source', profile.companySource);
    line('confidence', profile.confidence);
    console.log('');
    line('domain', profile.domain);
    line('registrar', profile.registrar);
    line('contact', profile.contactEmail);
    line('country', profile.country);
    line('address', profile.address);
    line('registered', profile.events.registration);
    line('expires', profile.events.expiration);
    line('changed', profile.events.lastChanged);
    line('status', profile.status);
    line('nameservers', profile.nameservers);
    line('redacted', profile.redactedFields);
    line('answered by', profile.server);
  }

  if (network && network.organisation) {
    console.log('');
    console.log(`  NETWORK        ${network.organisation}`);
    line('ip', network.ip);
    line('network', network.networkName);
    line('country', network.country);
  }

  if (notes.length) {
    console.log('');
    for (const note of notes) console.log(`  note: ${note}`);
  }
  console.log('');
}

rdapService.setDemoMode(demo);

rdapService.lookup(input)
  .then((result) => {
    if (asJson) console.log(JSON.stringify(result, null, 2));
    else report(result);
  })
  .catch((error) => {
    console.error(`\n  Lookup failed: ${error.message}`);
    if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|blocked/i.test(error.message)) {
      console.error('  This machine could not reach the RDAP servers (proxy, firewall or DNS).');
    }
    console.error('');
    process.exit(1);
  });
