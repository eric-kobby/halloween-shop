var domainHelper = (function () {

  /**
   * Mailbox providers where the domain registrant is the mail provider itself,
   * so an RDAP lookup can never name the sender's employer.
   */
  const PUBLIC_MAILBOX_PROVIDERS = [
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
    'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
    'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
    'pm.me', 'gmx.com', 'gmx.de', 'gmx.net', 'mail.com', 'mail.ru', 'zoho.com',
    'yandex.com', 'yandex.ru', 'qq.com', '163.com', '126.com', 'fastmail.com',
    'hey.com', 'tutanota.com', 'tuta.com', 'web.de', 't-online.de', 'orange.fr',
    'free.fr', 'laposte.net', 'comcast.net', 'verizon.net', 'sbcglobal.net',
    'btinternet.com', 'shaw.ca', 'rogers.com'
  ];

  /**
   * Placeholders registries publish in place of a contact once a record is
   * redacted, plus the better known privacy / proxy registration services.
   */
  const REDACTION_MARKERS = [
    'redacted', 'not disclosed', 'non-public data', 'data protected',
    'data privacy protected', 'gdpr masked', 'statutory masking',
    'withheld for privacy', 'privacy service', 'privacy protect',
    'privacy inc', 'private by design', 'domains by proxy', 'perfect privacy',
    'contact privacy', 'whoisguard', 'identity protection', 'proxy protection',
    'protection service', 'anonymize', 'super privacy service', 'not applicable',
    'n/a', '-'
  ];

  function DomainHelper() { }

  /**
   * Reduces anything host shaped - a bare domain, a URL, an IDN - to a
   * lowercase, punycoded hostname. `new URL()` does the IDNA work for us.
   * @param {string} raw
   * @returns {string}
   */
  DomainHelper.prototype.normalizeHost = function (raw) {
    const value = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!value) throw new Error('Enter an email address or a domain name.');

    let host;
    try {
      host = new URL(value.includes('://') ? value : `https://${value}`).hostname;
    } catch (error) {
      throw new Error(`"${raw}" is not a valid domain name.`);
    }

    host = host.replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');

    if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) {
      throw new Error(`"${raw}" is not a valid domain name.`);
    }
    if (!/\.(xn--[a-z0-9-]+|[a-z]{2,})$/.test(host)) {
      throw new Error(`"${raw}" does not end in a usable top level domain.`);
    }
    return host;
  };

  /**
   * Accepts an email address, a domain or a URL and reports what was given.
   * @param {string} raw
   * @returns {{
   *  raw: string;
   *  type: 'email' | 'domain';
   *  email: string | null;
   *  domain: string;
   *  publicMailbox: boolean;
   * }}
   */
  DomainHelper.prototype.parse = function (raw) {
    const input = String(raw == null ? '' : raw).trim().replace(/^mailto:/i, '');
    if (!input) throw new Error('Enter an email address or a domain name.');

    const separator = input.lastIndexOf('@');
    const isEmail = separator > 0;

    if (isEmail && /\s/.test(input.slice(0, separator))) {
      throw new Error(`"${raw}" is not a valid email address.`);
    }

    const domain = this.normalizeHost(isEmail ? input.slice(separator + 1) : input);

    return {
      raw: input,
      type: isEmail ? 'email' : 'domain',
      email: isEmail ? input.toLowerCase() : null,
      domain,
      publicMailbox: this.isPublicMailbox(domain)
    };
  };

  /**
   * RDAP is answered by the registry of the registered domain, so a host such
   * as `mail.eu.acme.com` has to be walked up a label at a time until the
   * registry recognises it. Keeps registry suffixes like `co.uk` working
   * without shipping the public suffix list.
   * @param {string} host
   * @returns {Array<string>}
   */
  DomainHelper.prototype.registrableCandidates = function (host) {
    const labels = String(host || '').split('.').filter(Boolean);
    const candidates = [];
    for (let index = 0; index <= labels.length - 2; index++) {
      candidates.push(labels.slice(index).join('.'));
    }
    return candidates;
  };

  /**
   * @param {string} domain
   * @returns {boolean}
   */
  DomainHelper.prototype.isPublicMailbox = function (domain) {
    return PUBLIC_MAILBOX_PROVIDERS.includes(String(domain || '').toLowerCase());
  };

  /**
   * True when a value is a redaction placeholder or a privacy service standing
   * in for the real registrant, rather than a company we can report.
   * @param {string} value
   * @returns {boolean}
   */
  DomainHelper.prototype.looksRedacted = function (value) {
    if (!value) return true;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return true;
    return REDACTION_MARKERS.some((marker) => normalized.includes(marker));
  };

  return new DomainHelper();
}());
