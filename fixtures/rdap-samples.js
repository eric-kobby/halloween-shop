/**
 * Synthetic RDAP responses used by the page's "sample data" mode, so the
 * lookup can be demonstrated and tested without reaching the live registries.
 *
 * Every name here is from a reserved documentation range (RFC 2606 `.example`
 * domains, RFC 5737 `203.0.113.0/24` addresses); none of it describes a real
 * organisation. The shapes follow RFC 9083 so the same parsing code runs
 * against sample and live records alike.
 */
var rdapFixtures = (function () {

  const BOOTSTRAP = {
    description: 'Sample RDAP bootstrap file for the demo registry',
    services: [
      [['example'], ['https://rdap.demo.example/registry/']]
    ]
  };

  /** A company that publishes a full registrant organisation. */
  const CANDY_CORP = {
    objectClassName: 'domain',
    handle: 'DEMO-1001',
    ldhName: 'candy-corp.example',
    status: ['client transfer prohibited', 'server delete prohibited'],
    events: [
      { eventAction: 'registration', eventDate: '2004-10-31T09:00:00Z' },
      { eventAction: 'expiration', eventDate: '2027-10-31T09:00:00Z' },
      { eventAction: 'last changed', eventDate: '2025-09-02T14:21:07Z' }
    ],
    entities: [
      {
        objectClassName: 'entity',
        handle: 'DEMO-REGISTRAR-7',
        roles: ['registrar'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Lantern Registrar Services Ltd.']
        ]],
        entities: [
          {
            objectClassName: 'entity',
            roles: ['abuse'],
            vcardArray: ['vcard', [
              ['version', {}, 'text', '4.0'],
              ['fn', {}, 'text', 'Registrar Abuse Desk'],
              ['email', {}, 'text', 'abuse@lantern-registrar.example']
            ]]
          }
        ]
      },
      {
        objectClassName: 'entity',
        handle: 'DEMO-REGISTRANT-1',
        roles: ['registrant'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Morticia Vale'],
          ['kind', {}, 'text', 'org'],
          ['org', {}, 'text', 'Candy Corp International, Inc.'],
          ['adr', {}, 'text', ['', '', '13 Pumpkin Row', 'Salem', 'MA', '01970', 'US']],
          ['email', {}, 'text', 'domains@candy-corp.example'],
          ['tel', { type: 'voice' }, 'uri', 'tel:+1.5551234567']
        ]]
      },
      {
        objectClassName: 'entity',
        roles: ['technical'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Candy Corp Network Operations'],
          ['org', {}, 'text', 'Candy Corp International, Inc.']
        ]]
      }
    ],
    nameservers: [
      { objectClassName: 'nameserver', ldhName: 'NS1.CANDY-CORP.EXAMPLE' },
      { objectClassName: 'nameserver', ldhName: 'NS2.CANDY-CORP.EXAMPLE' }
    ]
  };

  /** Registrant withheld, but the administrative contact still names the company. */
  const ACME_LOGISTICS = {
    objectClassName: 'domain',
    handle: 'DEMO-1002',
    ldhName: 'acme-logistics.example',
    status: ['active'],
    events: [
      { eventAction: 'registration', eventDate: '2013-03-18T11:45:00Z' },
      { eventAction: 'expiration', eventDate: '2026-03-18T11:45:00Z' }
    ],
    entities: [
      {
        objectClassName: 'entity',
        roles: ['registrar'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Hallow Domains AG']
        ]]
      },
      {
        objectClassName: 'entity',
        roles: ['registrant'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'REDACTED FOR PRIVACY'],
          ['org', {}, 'text', 'REDACTED FOR PRIVACY'],
          ['adr', { label: 'REDACTED FOR PRIVACY' }, 'text', ['', '', '', '', '', '', 'DE']]
        ]]
      },
      {
        objectClassName: 'entity',
        roles: ['administrative'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Domain Administrator'],
          ['org', {}, 'text', 'Acme Logistics Group GmbH'],
          ['adr', {}, 'text', ['', '', 'Hafenstrasse 4', 'Hamburg', '', '20359', 'DE']],
          ['email', {}, 'text', 'hostmaster@acme-logistics.example']
        ]]
      }
    ],
    nameservers: [
      { objectClassName: 'nameserver', ldhName: 'a.ns.acme-logistics.example' }
    ]
  };

  /** Fully redacted, the usual shape of a generic TLD record since 2018. */
  const SHADOW_SWEETS = {
    objectClassName: 'domain',
    handle: 'DEMO-1003',
    ldhName: 'shadow-sweets.example',
    status: ['client transfer prohibited'],
    events: [
      { eventAction: 'registration', eventDate: '2019-08-01T00:00:00Z' },
      { eventAction: 'expiration', eventDate: '2026-08-01T00:00:00Z' }
    ],
    redacted: [
      { name: { type: 'Registrant Name' }, reason: { description: 'Server policy' }, method: 'removal' },
      { name: { type: 'Registrant Organization' }, reason: { description: 'Server policy' }, method: 'removal' }
    ],
    entities: [
      {
        objectClassName: 'entity',
        roles: ['registrar'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Nightshade Registrations LLC']
        ]]
      },
      {
        objectClassName: 'entity',
        roles: ['registrant'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Withheld for Privacy ehf'],
          ['org', {}, 'text', 'Privacy service provided by Withheld for Privacy ehf']
        ]]
      }
    ],
    nameservers: [
      { objectClassName: 'nameserver', ldhName: 'ns1.shadow-host.example' }
    ]
  };

  /** RIR record reached through the DNS -> IP -> RDAP fallback. */
  const NETWORK_203_0_113_10 = {
    objectClassName: 'ip network',
    handle: 'DEMO-NET-203-0-113-0',
    startAddress: '203.0.113.0',
    endAddress: '203.0.113.255',
    ipVersion: 'v4',
    name: 'EXAMPLE-HOSTING-NET',
    type: 'ALLOCATION',
    country: 'NL',
    entities: [
      {
        objectClassName: 'entity',
        handle: 'DEMO-ORG-EH',
        roles: ['registrant'],
        vcardArray: ['vcard', [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Example Hosting B.V.'],
          ['kind', {}, 'text', 'org'],
          ['org', {}, 'text', 'Example Hosting B.V.'],
          ['adr', {}, 'text', ['', '', 'Keizersgracht 1', 'Amsterdam', '', '1015', 'NL']]
        ]]
      }
    ]
  };

  const DOMAINS = {
    'candy-corp.example': CANDY_CORP,
    'acme-logistics.example': ACME_LOGISTICS,
    'shadow-sweets.example': SHADOW_SWEETS
  };

  const ADDRESSES = {
    'shadow-sweets.example': '203.0.113.10',
    'candy-corp.example': '203.0.113.20'
  };

  const NETWORKS = {
    '203.0.113.10': NETWORK_203_0_113_10,
    '203.0.113.20': NETWORK_203_0_113_10
  };

  function notFound(what) {
    return {
      status: 404,
      body: {
        errorCode: 404,
        title: 'Not found in sample data',
        description: [`${what} is not part of the bundled sample records. Turn sample data off to query the live registries.`]
      }
    };
  }

  function FixtureStore() {
    this.sampleDomains = Object.keys(DOMAINS);
  }

  /**
   * Answers an RDAP or DNS-over-HTTPS request from the bundled records.
   * @param {string} url
   * @returns {{ status: number; body: any }}
   */
  FixtureStore.prototype.respond = function (url) {
    const parsed = new URL(url);

    if (parsed.hostname === 'data.iana.org') {
      return { status: 200, body: BOOTSTRAP };
    }

    if (parsed.hostname === 'dns.google') {
      const name = String(parsed.searchParams.get('name') || '').toLowerCase();
      const address = ADDRESSES[name];
      if (!address) return { status: 200, body: { Status: 3, Answer: [] } };
      return { status: 200, body: { Status: 0, Answer: [{ name, type: 1, TTL: 300, data: address }] } };
    }

    const domainMatch = parsed.pathname.match(/\/domain\/([^/]+)\/?$/);
    if (domainMatch) {
      const name = decodeURIComponent(domainMatch[1]).toLowerCase();
      const record = DOMAINS[name];
      return record ? { status: 200, body: record } : notFound(name);
    }

    const ipMatch = parsed.pathname.match(/\/ip\/([^/]+)\/?$/);
    if (ipMatch) {
      const address = decodeURIComponent(ipMatch[1]);
      const network = NETWORKS[address];
      return network ? { status: 200, body: network } : notFound(address);
    }

    return notFound(url);
  };

  return new FixtureStore();
}());
