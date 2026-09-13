# Freddy's Artisanal Halloween Candy Shop

A small back office for the candy shop, written as plain HTML, CSS and browser
JavaScript - there is no build step and no dependencies.

| Page | What it does |
| --- | --- |
| `index.html` | Login against the `freddy.codesubmit.io` API |
| `pages/Dashboard.html` | Sales summary, revenue chart and bestsellers |
| `pages/Orders.html` | Paginated, searchable order list |
| `pages/Lookup.html` | **Company lookup** - resolves an email address or domain to the company behind it using RDAP |

## Running it

Serve the folder over HTTP (opening the files with `file://` breaks `fetch`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

The dashboard and orders pages need a login. The company lookup page does not -
RDAP is public data - so it can be opened directly at
<http://localhost:8000/pages/Lookup.html>.

## Company lookup

Freddy's gets orders from both individuals and businesses. Given a customer's
email address (`sam.hain@candy-corp.example`) or a domain, the lookup page asks
the domain's registry who registered it and reports the company name, with the
supporting registration record.

It uses [RDAP](https://datatracker.ietf.org/doc/html/rfc7483) (the Registration
Data Access Protocol), the JSON successor to WHOIS. RDAP is queried directly
from the browser - there is no server component and no API key.

### How a lookup runs

1. **Parse the input.** An email address is reduced to its domain; a URL is
   reduced to its hostname; internationalised names are punycoded
   (`bücher.de` → `xn--bcher-kva.de`).
2. **Find the registry.** IANA publishes the map of TLD → RDAP server
   ([RFC 9224](https://datatracker.ietf.org/doc/html/rfc9224)) at
   `data.iana.org/rdap/dns.json`. It is fetched once and cached in
   `localStorage` for a day. When it cannot be read, queries fall back to the
   `rdap.org` redirect service.
3. **Query the domain.** `GET {registry}/domain/{name}`. A hostname such as
   `mail.eu.acme.co.uk` is walked up a label at a time until the registry
   recognises a name, which is how subdomains and suffixes like `co.uk` resolve
   without shipping the public suffix list.
4. **Read the record.** Contacts arrive as jCard arrays
   ([RFC 7095](https://datatracker.ietf.org/doc/html/rfc7095)) inside RDAP
   entities. The company name is taken from the first published organisation in
   registrant → administrative → technical order. The **registrar is never used
   as the company name** - it is who sold the domain, not who owns it.
5. **Fall back to the network.** If no contact organisation is published, the
   domain is resolved to an IP over DNS-over-HTTPS and that address is looked up
   at its RIR, which names the network operator. This is labelled separately
   because it is frequently a hosting provider or CDN rather than the company.

### Reading the result

Each answer carries a confidence badge, because RDAP records vary enormously in
what they disclose:

| Badge | Meaning |
| --- | --- |
| High | Registrant organisation published by the registry |
| Medium | Registrant contact name, or an administrative contact's organisation |
| Low | Technical contact only |
| Not published | Nothing usable; the network operator may be shown instead |

Two cases are called out rather than answered:

- **Redacted records.** Since ICANN's 2018 Temporary Specification, most generic
  TLDs withhold registrant contacts, and many registrations sit behind privacy
  services. Placeholders (`REDACTED FOR PRIVACY`, `Withheld for Privacy ehf`,
  `Domains By Proxy`) are recognised and never reported as a company name.
- **Public mailbox providers.** For `gmail.com`, `outlook.com` and the like, the
  registrant is the mail provider, so no employer can be derived from the
  address. The page says so instead of reporting "Google LLC".

A list of addresses can be pasted into *Look up a list of customers*, which runs
three queries at a time and exports the results as CSV.

### Sample data mode

The **Sample data** switch answers every lookup from `fixtures/rdap-samples.js`
instead of the live registries, so the page can be demonstrated offline. The
records are synthetic and use reserved documentation names (`.example` domains,
`203.0.113.0/24` addresses); they never touch the live bootstrap cache. Sample
domains: `candy-corp.example` (full registrant), `acme-logistics.example`
(redacted registrant, administrative contact published) and
`shadow-sweets.example` (fully redacted, falls back to the network operator).

### Limitations

- **CORS.** gTLD registries are required to send `Access-Control-Allow-Origin: *`,
  so `.com`, `.org`, `.net` and friends work from the browser. Some ccTLD
  servers do not, and those lookups fail with a CORS error in the console - they
  need a proxy the browser can reach.
- **No RDAP at all.** Several ccTLDs (`.de` among them) still publish WHOIS
  only. The page reports that rather than guessing.
- **Rate limits.** Registries throttle aggressively; the bulk list is capped at
  50 entries and three concurrent requests.
- **RDAP is registration data.** It names whoever registered the domain, which
  for large groups is often a brand-protection subsidiary rather than the
  trading name a customer would recognise.

### Tests

The parsing pipeline runs under Node against the bundled fixtures - no
dependencies, no network:

```sh
node --test
```

### Files

```
helpers/domainHelper.js    email/URL/domain parsing, redaction and mailbox-provider detection
services/Rdapservice.js    RDAP bootstrap, queries, jCard parsing, network fallback
fixtures/rdap-samples.js   synthetic RDAP records for sample data mode
scripts/lookup.js          page behaviour: single lookup, bulk list, CSV export
pages/Lookup.html          the page
css/lookup.css             its styles
tests/rdap.test.js         Node test suite
```
