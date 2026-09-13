/**
 * Runs the browser sources under Node against the bundled sample records.
 *
 * The lookup page has no build step, so the scripts are loaded into this
 * context exactly as a <script> tag would load them.
 *
 *   node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
for (const file of ['helpers/domainHelper.js', 'fixtures/rdap-samples.js', 'services/Rdapservice.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

rdapService.setDemoMode(true);

test('parses emails, domains, URLs and internationalised names', () => {
  assert.deepEqual(domainHelper.parse('Sam.Hain@Candy-Corp.example'), {
    raw: 'Sam.Hain@Candy-Corp.example',
    type: 'email',
    email: 'sam.hain@candy-corp.example',
    domain: 'candy-corp.example',
    publicMailbox: false
  });

  assert.equal(domainHelper.parse('https://WWW.Candy-Corp.example/orders?id=7').domain, 'www.candy-corp.example');
  assert.equal(domainHelper.parse('mailto:sam@candy-corp.example').type, 'email');
  assert.equal(domainHelper.parse('bücher.de').domain, 'xn--bcher-kva.de');
  assert.equal(domainHelper.parse('sam@gmail.com').publicMailbox, true);

  assert.throws(() => domainHelper.parse(''), /Enter an email address/);
  assert.throws(() => domainHelper.parse('localhost'), /not a valid domain name/);
  assert.throws(() => domainHelper.parse('candy corp'), /not a valid domain name/);
});

test('walks a hostname up to the names a registry might know', () => {
  assert.deepEqual(
    domainHelper.registrableCandidates('mail.eu.acme.co.uk'),
    ['mail.eu.acme.co.uk', 'eu.acme.co.uk', 'acme.co.uk', 'co.uk']
  );
  assert.deepEqual(domainHelper.registrableCandidates('acme.com'), ['acme.com']);
});

test('recognises redaction placeholders and privacy services', () => {
  for (const value of ['REDACTED FOR PRIVACY', 'Data Redacted', 'Withheld for Privacy ehf',
    'Domains By Proxy, LLC', 'Not Disclosed', 'n/a', '', null]) {
    assert.equal(domainHelper.looksRedacted(value), true, `${value} should read as redacted`);
  }
  for (const value of ['Candy Corp International, Inc.', 'Acme Logistics Group GmbH']) {
    assert.equal(domainHelper.looksRedacted(value), false, `${value} should read as a real name`);
  }
});

test('reads jCard names, organisations and structured addresses', () => {
  const card = rdapService.parseVcard(['vcard', [
    ['version', {}, 'text', '4.0'],
    ['fn', {}, 'text', 'Morticia Vale'],
    ['org', {}, 'text', ['Candy Corp International, Inc.', 'Procurement']],
    ['adr', {}, 'text', ['', '', '13 Pumpkin Row', 'Salem', 'MA', '01970', 'US']],
    ['email', {}, 'text', 'domains@candy-corp.example']
  ]]);

  assert.equal(card.fn, 'Morticia Vale');
  assert.equal(card.org, 'Candy Corp International, Inc., Procurement');
  assert.equal(card.city, 'Salem');
  assert.equal(card.region, 'MA');
  assert.equal(card.country, 'US');
  assert.equal(card.email, 'domains@candy-corp.example');

  // Some registries send empty components and a readable label parameter.
  const labelled = rdapService.parseVcard(['vcard', [
    ['adr', { label: 'Hafenstrasse 4, Hamburg, DE' }, 'text', ['', '', '', '', '', '', '']]
  ]]);
  assert.equal(labelled.address, 'Hafenstrasse 4, Hamburg, DE');

  assert.deepEqual(rdapService.parseVcard(null).fn, null);
  assert.deepEqual(rdapService.parseVcard(['vcard']).org, null);
});

test('finds entities nested inside other entities', () => {
  const record = rdapFixtures.respond('https://rdap.demo.example/registry/domain/candy-corp.example').body;
  const abuse = rdapService.findEntities(record.entities, 'abuse');

  assert.equal(abuse.length, 1);
  assert.equal(rdapService.parseVcard(abuse[0].vcardArray).email, 'abuse@lantern-registrar.example');
});

test('reports the registrant organisation when one is published', async () => {
  const result = await rdapService.lookup('sam.hain@candy-corp.example');

  assert.equal(result.found, true);
  assert.equal(result.query.type, 'email');
  assert.equal(result.profile.companyName, 'Candy Corp International, Inc.');
  assert.equal(result.profile.companySource, 'registrant organisation');
  assert.equal(result.profile.confidence, 'high');
  assert.equal(result.profile.registrar, 'Lantern Registrar Services Ltd.');
  assert.equal(result.profile.contactEmail, 'domains@candy-corp.example');
  assert.equal(result.profile.country, 'US');
  assert.equal(result.profile.events.registration, '2004-10-31T09:00:00Z');
  assert.deepEqual(result.profile.nameservers, ['ns1.candy-corp.example', 'ns2.candy-corp.example']);
  assert.equal(result.network, null, 'no network fallback is needed when a company is named');
});

test('falls back to the administrative contact when the registrant is redacted', async () => {
  const result = await rdapService.lookup('acme-logistics.example');

  assert.equal(result.profile.companyName, 'Acme Logistics Group GmbH');
  assert.equal(result.profile.companySource, 'administrative organisation');
  assert.equal(result.profile.confidence, 'medium');
  assert.equal(result.profile.country, 'DE');
});

test('never reports a privacy service as the company, and names the network instead', async () => {
  const result = await rdapService.lookup('trick@shadow-sweets.example');

  assert.equal(result.profile.companyName, null);
  assert.equal(result.profile.confidence, 'none');
  assert.equal(result.profile.registrar, 'Nightshade Registrations LLC');
  assert.deepEqual(result.profile.redactedFields, ['Registrant Name', 'Registrant Organization']);

  assert.equal(result.network.organisation, 'Example Hosting B.V.');
  assert.equal(result.network.ip, '203.0.113.10');
  assert.match(result.notes.join(' '), /hosting provider or CDN/);
  assert.match(result.notes.join(' '), /redacted: Registrant Name/);
});

test('queries the registered name when given a subdomain', async () => {
  const result = await rdapService.lookup('news.eu.candy-corp.example');

  assert.equal(result.found, true);
  assert.equal(result.profile.domain, 'candy-corp.example');
  assert.match(result.notes.join(' '), /is a subdomain/);
});

test('refuses to guess an employer from a public mailbox provider', async () => {
  const result = await rdapService.lookup('sam@gmail.com');

  assert.equal(result.query.publicMailbox, true);
  assert.match(result.notes[0], /public mailbox provider/);
  assert.equal(result.network, null, 'a mailbox provider network says nothing about the sender');
});

test('reports an unregistered name without inventing a company', async () => {
  const result = await rdapService.lookup('no-such-shop.example');

  assert.equal(result.found, false);
  assert.equal(result.status, 404);
  assert.equal(result.profile, null);
  assert.match(result.notes.join(' '), /No RDAP record was published/);
});

test('keeps sample records out of the persistent bootstrap cache', async () => {
  const writes = [];
  globalThis.localStorageHelper = {
    getItem: () => false,
    setItem: (key, value) => writes.push([key, value])
  };

  try {
    rdapService.setDemoMode(true);
    await rdapService.lookup('candy-corp.example');
    assert.deepEqual(writes, [], 'demo mode must not persist a fake bootstrap registry');
  } finally {
    delete globalThis.localStorageHelper;
    rdapService.setDemoMode(true);
  }
});
