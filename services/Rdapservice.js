var rdapService = (function () {

  // RFC 9224: IANA publishes the map of TLD -> authoritative RDAP server.
  const IANA_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
  const BOOTSTRAP_CACHE_KEY = 'RDAP_DNS_BOOTSTRAP';
  const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
  // Redirect service used when the bootstrap file is unreachable, and for IP
  // queries, where it forwards to the responsible RIR.
  const REDIRECT_SERVICE = 'https://rdap.org';
  const DOH_ENDPOINT = 'https://dns.google/resolve';
  const RDAP_MEDIA_TYPE = 'application/rdap+json';

  // The registrar is who sold the domain, never the company behind it, so it
  // is deliberately absent from this list.
  const COMPANY_ROLES = ['registrant', 'administrative', 'technical'];
  const NETWORK_ROLES = ['registrant', 'administrative', 'technical', 'abuse'];

  function RdapService() {
    this.cache = new Map();
    // Serves the bundled sample records instead of the live registries, so the
    // page can be demonstrated offline. See fixtures/rdap-samples.js.
    this.demoMode = false;
  }

  /**
   * Switches between the live registries and the bundled sample records.
   * Results cached under one mode are dropped, never served under the other.
   * @param {boolean} enabled
   */
  RdapService.prototype.setDemoMode = function (enabled) {
    this.demoMode = Boolean(enabled);
    this.cache.clear();
  };

  /**
   * @param {string} url
   * @param {string} accept
   * @returns {Promise<{ status: number; body: any }>}
   */
  RdapService.prototype.request = async function (url, accept = RDAP_MEDIA_TYPE) {
    if (this.demoMode) return rdapFixtures.respond(url);

    const response = await fetch(url, { headers: { 'Accept': accept } });
    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      // RDAP errors and 404s are frequently served with an empty body.
      body = null;
    }
    return { status: response.status, body };
  };

  RdapService.prototype.readCachedBootstrap = function () {
    if (this.demoMode || typeof localStorageHelper === 'undefined') return null;
    try {
      const cached = localStorageHelper.getItem(BOOTSTRAP_CACHE_KEY);
      if (!cached || !cached.fetchedAt) return null;
      if (Date.now() - cached.fetchedAt > BOOTSTRAP_TTL_MS) return null;
      return cached.bootstrap;
    } catch (error) {
      return null;
    }
  };

  RdapService.prototype.writeCachedBootstrap = function (bootstrap) {
    // Sample records must never be persisted as if they were the real registry.
    if (this.demoMode || typeof localStorageHelper === 'undefined') return;
    try {
      localStorageHelper.setItem(BOOTSTRAP_CACHE_KEY, { fetchedAt: Date.now(), bootstrap });
    } catch (error) {
      // A full or disabled localStorage only costs us the cache.
    }
  };

  RdapService.prototype.getBootstrap = async function () {
    const cached = this.readCachedBootstrap();
    if (cached) return cached;

    const { status, body } = await this.request(IANA_BOOTSTRAP_URL, 'application/json');
    if (status !== 200 || !body || !Array.isArray(body.services)) {
      throw new Error('The IANA RDAP bootstrap registry could not be read.');
    }
    this.writeCachedBootstrap(body);
    return body;
  };

  /**
   * Resolves the RDAP base URL responsible for a domain's TLD.
   * @param {string} domain
   * @returns {Promise<{ base: string; bootstrapped: boolean }>}
   */
  RdapService.prototype.serverFor = async function (domain) {
    const tld = String(domain || '').split('.').pop();
    try {
      const bootstrap = await this.getBootstrap();
      for (const [tlds, servers] of bootstrap.services) {
        const serves = Array.isArray(tlds) && tlds.some((entry) => String(entry).toLowerCase() === tld);
        if (serves && Array.isArray(servers) && servers.length) {
          return { base: servers[0].replace(/\/$/, ''), bootstrapped: true };
        }
      }
    } catch (error) {
      return { base: REDIRECT_SERVICE, bootstrapped: false };
    }
    // The TLD is not in the registry - many ccTLDs still run WHOIS only.
    return { base: REDIRECT_SERVICE, bootstrapped: false };
  };

  /**
   * Queries the registry for the first candidate name it recognises.
   * @param {string} host
   * @returns {Promise<{ domain: string; record: any; server: string | null; status: number; bootstrapped: boolean }>}
   */
  RdapService.prototype.lookupDomain = async function (host) {
    const cacheKey = `domain:${host}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const candidates = domainHelper.registrableCandidates(host).slice(0, 4);
    let outcome = { domain: host, record: null, server: null, status: 404, bootstrapped: false };

    for (const candidate of candidates) {
      const { base, bootstrapped } = await this.serverFor(candidate);
      const { status, body } = await this.request(`${base}/domain/${encodeURIComponent(candidate)}`);

      if (status === 200 && body) {
        outcome = { domain: candidate, record: body, server: base, status, bootstrapped };
        break;
      }
      outcome = { domain: candidate, record: null, server: base, status, bootstrapped };
      // Anything other than "no such domain" is a server problem; walking
      // further up the name would not help.
      if (status !== 404) break;
    }

    this.cache.set(cacheKey, outcome);
    return outcome;
  };

  /**
   * Flattens a jCard value, which may be a string or a structured array.
   * @param {string | Array} value
   * @returns {string | null}
   */
  function flattenValue(value) {
    if (Array.isArray(value)) {
      const parts = value.map((part) => String(part == null ? '' : part).trim()).filter(Boolean);
      return parts.length ? parts.join(', ') : null;
    }
    const text = String(value == null ? '' : value).trim();
    return text || null;
  }

  /**
   * Reads the jCard (RFC 7095) carried by an RDAP entity.
   * @param {Array} vcardArray
   * @returns {{
   *  fn: string | null; org: string | null; kind: string | null;
   *  email: string | null; tel: string | null; city: string | null;
   *  region: string | null; country: string | null; address: string | null;
   * }}
   */
  RdapService.prototype.parseVcard = function (vcardArray) {
    const card = {
      fn: null, org: null, kind: null, email: null,
      tel: null, city: null, region: null, country: null, address: null
    };
    if (!Array.isArray(vcardArray) || vcardArray[0] !== 'vcard' || !Array.isArray(vcardArray[1])) {
      return card;
    }

    for (const entry of vcardArray[1]) {
      if (!Array.isArray(entry) || entry.length < 4) continue;
      const name = String(entry[0]).toLowerCase();
      const parameters = entry[1] && typeof entry[1] === 'object' ? entry[1] : {};
      const value = entry[3];

      switch (name) {
        case 'fn':
          if (!card.fn) card.fn = flattenValue(value);
          break;
        case 'org':
          if (!card.org) card.org = flattenValue(value);
          break;
        case 'kind':
          card.kind = (flattenValue(value) || '').toLowerCase() || null;
          break;
        case 'email':
          if (!card.email) card.email = flattenValue(value);
          break;
        case 'tel':
          if (!card.tel) card.tel = flattenValue(value);
          break;
        case 'adr': {
          // jCard address components:
          // [po box, extended, street, locality, region, postcode, country]
          const parts = Array.isArray(value) ? value : String(value == null ? '' : value).split(';');
          card.city = flattenValue(parts[3]);
          card.region = flattenValue(parts[4]);
          card.country = flattenValue(parts[6]);
          // Several registries send an empty component array and put the
          // readable address in the "label" parameter instead.
          card.address = flattenValue(parameters.label) || flattenValue(parts);
          break;
        }
        default:
          break;
      }
    }
    return card;
  };

  /**
   * Collects every entity holding a role, including entities nested inside
   * other entities (an abuse contact under a registrar, for instance).
   * @param {Array} entities
   * @param {string} role
   * @returns {Array}
   */
  RdapService.prototype.findEntities = function (entities, role) {
    const found = [];
    (function walk(list) {
      if (!Array.isArray(list)) return;
      for (const entity of list) {
        if (!entity || typeof entity !== 'object') continue;
        if (Array.isArray(entity.roles) && entity.roles.includes(role)) found.push(entity);
        walk(entity.entities);
      }
    }(entities));
    return found;
  };

  /**
   * @param {any} record
   * @param {string} action
   * @returns {string | null}
   */
  RdapService.prototype.eventDate = function (record, action) {
    const events = Array.isArray(record && record.events) ? record.events : [];
    const event = events.find((item) => item && item.eventAction === action);
    return event && event.eventDate ? event.eventDate : null;
  };

  /**
   * Picks the company name out of a domain record, preferring the registrant
   * organisation and falling back through the other published contacts.
   * @param {any} record
   * @returns {{ name: string; source: string; confidence: string; contact: any } | null}
   */
  RdapService.prototype.extractCompany = function (record) {
    for (const role of COMPANY_ROLES) {
      for (const entity of this.findEntities(record && record.entities, role)) {
        const card = this.parseVcard(entity.vcardArray);

        if (!domainHelper.looksRedacted(card.org)) {
          return {
            name: card.org,
            source: `${role} organisation`,
            confidence: role === 'registrant' ? 'high' : 'medium',
            contact: card
          };
        }
        // `fn` holds an organisation for a company registration and a person's
        // name for an individual one, so it is reported a notch lower.
        if (!domainHelper.looksRedacted(card.fn) && card.kind !== 'individual') {
          return {
            name: card.fn,
            source: `${role} contact name`,
            confidence: role === 'registrant' ? 'medium' : 'low',
            contact: card
          };
        }
      }
    }
    return null;
  };

  /**
   * Field names the registry declared redacted under RFC 9537.
   * @param {any} record
   * @returns {Array<string>}
   */
  RdapService.prototype.redactedFields = function (record) {
    const redacted = Array.isArray(record && record.redacted) ? record.redacted : [];
    return redacted
      .map((item) => (item && item.name ? (item.name.type || item.name.description) : null))
      .filter(Boolean);
  };

  /**
   * Turns a raw RDAP domain record into the flat shape the page renders.
   * @param {{ domain: string; record: any; server: string | null }} lookup
   */
  RdapService.prototype.buildProfile = function (lookup) {
    const record = lookup.record || {};
    const company = this.extractCompany(record);
    const registrant = this.findEntities(record.entities, 'registrant')[0];
    const registrantCard = registrant ? this.parseVcard(registrant.vcardArray) : null;
    const registrar = this.findEntities(record.entities, 'registrar')
      .map((entity) => this.parseVcard(entity.vcardArray))
      .map((card) => card.org || card.fn)
      .find(Boolean) || null;
    const abuse = this.findEntities(record.entities, 'abuse')
      .map((entity) => this.parseVcard(entity.vcardArray).email)
      .find(Boolean) || null;

    return {
      domain: (record.ldhName || lookup.domain || '').toLowerCase(),
      unicodeName: record.unicodeName || null,
      companyName: company ? company.name : null,
      companySource: company ? company.source : null,
      confidence: company ? company.confidence : 'none',
      registrar,
      contactEmail: (company && company.contact ? company.contact.email : null)
        || (registrantCard ? registrantCard.email : null)
        || abuse,
      country: (company && company.contact ? company.contact.country : null)
        || (registrantCard ? registrantCard.country : null),
      address: company && company.contact ? company.contact.address : null,
      events: {
        registration: this.eventDate(record, 'registration'),
        expiration: this.eventDate(record, 'expiration'),
        lastChanged: this.eventDate(record, 'last changed')
      },
      status: Array.isArray(record.status) ? record.status : [],
      nameservers: (Array.isArray(record.nameservers) ? record.nameservers : [])
        .map((ns) => String(ns && ns.ldhName ? ns.ldhName : '').toLowerCase())
        .filter(Boolean),
      redactedFields: this.redactedFields(record),
      server: lookup.server,
      record
    };
  };

  /**
   * Resolves a hostname to an IPv4 address over DNS-over-HTTPS, so the browser
   * can reach the RDAP record of the network behind the domain.
   * @param {string} host
   * @returns {Promise<string | null>}
   */
  RdapService.prototype.resolveAddress = async function (host) {
    const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(host)}&type=A`;
    const { status, body } = await this.request(url, 'application/dns-json');
    if (status !== 200 || !body || !Array.isArray(body.Answer)) return null;

    const answer = body.Answer.find((item) => item && item.type === 1 && item.data);
    return answer ? answer.data : null;
  };

  /**
   * Looks up who an IP address is allocated to at the responsible RIR.
   * @param {string} ip
   */
  RdapService.prototype.lookupNetwork = async function (ip) {
    const { status, body } = await this.request(`${REDIRECT_SERVICE}/ip/${encodeURIComponent(ip)}`);
    if (status !== 200 || !body) return null;

    const entity = NETWORK_ROLES
      .map((role) => this.findEntities(body.entities, role)[0])
      .find(Boolean);
    const card = entity ? this.parseVcard(entity.vcardArray) : {};
    const organisation = !domainHelper.looksRedacted(card.org) ? card.org
      : (!domainHelper.looksRedacted(card.fn) ? card.fn : null);

    return {
      ip,
      organisation: organisation || body.name || null,
      networkName: body.name || null,
      handle: body.handle || null,
      country: body.country || card.country || null,
      record: body
    };
  };

  /**
   * Full lookup for one email address or domain.
   * @param {string} rawInput
   */
  RdapService.prototype.lookup = async function (rawInput) {
    const query = domainHelper.parse(rawInput);
    const notes = [];

    if (query.publicMailbox) {
      notes.push(`${query.domain} is a public mailbox provider, so its registrant is the mail service - not the sender's employer. A company name cannot be derived from this address.`);
    }

    const found = await this.lookupDomain(query.domain);

    if (!found.record) {
      if (found.status === 404) {
        notes.push(`No RDAP record was published for ${query.domain}. Its registry may still be WHOIS only, or the domain may not be registered.`);
      } else {
        notes.push(`The RDAP server answered with HTTP ${found.status} for ${query.domain}.`);
      }
      return { query, found: false, status: found.status, notes, profile: null, network: null };
    }

    const profile = this.buildProfile(found);
    let network = null;

    if (found.domain !== query.domain) {
      notes.push(`${query.domain} is a subdomain; the registered name ${found.domain} was queried instead.`);
    }
    if (profile.redactedFields.length) {
      notes.push(`The registry redacted: ${profile.redactedFields.join(', ')}.`);
    }

    if (!profile.companyName && !query.publicMailbox) {
      // Registrant details are withheld for most gTLDs since the ICANN
      // Temporary Specification, so fall back to who runs the servers.
      try {
        const ip = await this.resolveAddress(query.domain);
        if (ip) network = await this.lookupNetwork(ip);
      } catch (error) {
        network = null;
      }

      if (network && network.organisation) {
        notes.push('No contact organisation is published, so the operator of the domain\'s network is shown instead. This is often a hosting provider or CDN rather than the company itself.');
      } else {
        notes.push('No company name is published for this domain. Registrant contact data is withheld for most generic TLDs.');
      }
    }

    return { query, found: true, status: found.status, notes, profile, network };
  };

  return new RdapService();
}());
