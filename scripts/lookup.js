(function () {

  const form = document.querySelector('#lookup-form');
  const input = document.querySelector('#lookup-input');
  const demoToggle = document.querySelector('#demo-toggle');
  const demoHint = document.querySelector('#demo-hint');
  const status = document.querySelector('#lookup-status');
  const result = document.querySelector('#result');

  const bulkForm = document.querySelector('#bulk-form');
  const bulkInput = document.querySelector('#bulk-input');
  const bulkRows = document.querySelector('#bulk-rows');
  const bulkProgress = document.querySelector('#bulk-progress');
  const bulkExport = document.querySelector('#bulk-export');

  const CONFIDENCE_LABELS = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
    none: 'Not published'
  };
  const BULK_CONCURRENCY = 3;
  const BULK_LIMIT = 50;

  let exported = [];

  const escape = (value) => formatHelper.escapeHtml(value);

  /**
   * @param {string} isoDate
   * @returns {string}
   */
  function formatDate(isoDate) {
    if (!isoDate) return '-';
    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? isoDate : formatHelper.formatDate(date);
  }

  /**
   * @param {string} label
   * @param {string} value
   * @returns {string}
   */
  function field(label, value) {
    if (!value || value === '-') return '';
    return `
      <div class="field">
        <span class="field-label">${escape(label)}</span>
        <span class="field-value">${escape(value)}</span>
      </div>
    `;
  }

  function renderNetwork(network) {
    if (!network || !network.organisation) return '';
    return `
      <div class="network outline-border">
        <h3 class="typography">Network operator</h3>
        <p class="muted">Who the domain's IP address is allocated to, used only because no contact organisation is published.</p>
        <div class="fields">
          ${field('Organisation', network.organisation)}
          ${field('IP address', network.ip)}
          ${field('Network', network.networkName)}
          ${field('Country', network.country)}
        </div>
      </div>
    `;
  }

  function renderNotes(notes) {
    if (!notes || !notes.length) return '';
    return `
      <ul class="notes">
        ${notes.map((note) => `<li>${escape(note)}</li>`).join('')}
      </ul>
    `;
  }

  /**
   * @param {any} lookup
   */
  function renderResult(lookup) {
    const profile = lookup.profile;

    if (!profile) {
      result.innerHTML = `
        <div class="result-card outline-border">
          <h2 class="company-name muted">No RDAP record</h2>
          <p class="source">Queried <code>${escape(lookup.query.domain)}</code></p>
          ${renderNotes(lookup.notes)}
        </div>
      `;
      return;
    }

    const name = profile.companyName;
    const confidence = profile.confidence;

    result.innerHTML = `
      <div class="result-card outline-border">
        <div class="result-header">
          <h2 class="company-name ${name ? '' : 'muted'}">${escape(name || 'No company name published')}</h2>
          <span class="badge badge-${escape(confidence)}">${escape(CONFIDENCE_LABELS[confidence] || confidence)}</span>
        </div>
        <p class="source">
          ${name ? `From the ${escape(profile.companySource)} of` : 'Record for'}
          <code>${escape(profile.domain)}</code>
          ${lookup.query.email ? `&middot; asked about <code>${escape(lookup.query.email)}</code>` : ''}
        </p>

        <div class="fields">
          ${field('Registrar', profile.registrar)}
          ${field('Contact email', profile.contactEmail)}
          ${field('Country', profile.country)}
          ${field('Address', profile.address)}
          ${field('Registered', formatDate(profile.events.registration))}
          ${field('Expires', formatDate(profile.events.expiration))}
          ${field('Last changed', formatDate(profile.events.lastChanged))}
          ${field('Status', profile.status.join(', '))}
          ${field('Nameservers', profile.nameservers.join(', '))}
          ${field('Answered by', profile.server)}
        </div>

        ${renderNetwork(lookup.network)}
        ${renderNotes(lookup.notes)}

        <details class="raw">
          <summary>Raw RDAP response</summary>
          <pre>${escape(JSON.stringify(profile.record, null, 2))}</pre>
        </details>
      </div>
    `;
  }

  /**
   * @param {string} message
   * @param {boolean} isError
   */
  function setStatus(message, isError = false) {
    status.textContent = message || '';
    status.classList.toggle('text-danger', Boolean(isError));
  }

  async function runLookup(value) {
    setStatus('Looking up ...');
    result.innerHTML = '';
    try {
      const lookup = await rdapService.lookup(value);
      renderResult(lookup);
      setStatus('');
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'The lookup failed.', true);
    }
  }

  /**
   * Splits a pasted list of addresses on commas, semicolons and whitespace.
   * @param {string} text
   * @returns {Array<string>}
   */
  function parseList(text) {
    const entries = String(text || '')
      .split(/[\s,;]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return Array.from(new Set(entries));
  }

  /**
   * @param {string} entry
   */
  async function bulkRow(entry) {
    try {
      const lookup = await rdapService.lookup(entry);
      return {
        input: entry,
        domain: lookup.profile ? lookup.profile.domain : lookup.query.domain,
        company: lookup.profile && lookup.profile.companyName ? lookup.profile.companyName : '',
        source: lookup.profile && lookup.profile.companyName ? lookup.profile.companySource : '',
        confidence: lookup.profile ? lookup.profile.confidence : 'none',
        registrar: lookup.profile ? (lookup.profile.registrar || '') : '',
        network: lookup.network && lookup.network.organisation ? lookup.network.organisation : '',
        error: ''
      };
    } catch (error) {
      return {
        input: entry, domain: '', company: '', source: '',
        confidence: 'none', registrar: '', network: '',
        error: error.message || 'lookup failed'
      };
    }
  }

  function appendBulkRow(row) {
    const tr = document.createElement('tr');
    const company = row.company
      || (row.network ? `${row.network} (network operator)` : '')
      || (row.error ? row.error : 'Not published');

    tr.innerHTML = `
      <td>${escape(row.input)}</td>
      <td>${escape(row.domain || '-')}</td>
      <td class="${row.company ? '' : 'muted'}">${escape(company)}</td>
      <td><span class="badge badge-${escape(row.confidence)}">${escape(CONFIDENCE_LABELS[row.confidence] || row.confidence)}</span></td>
      <td>${escape(row.registrar || '-')}</td>
    `;
    bulkRows.appendChild(tr);
  }

  /**
   * Runs the queue a few requests at a time; registries rate limit hard.
   * @param {Array<string>} entries
   */
  async function runBulk(entries) {
    bulkRows.replaceChildren();
    bulkExport.classList.add('d-none');
    exported = [];

    let started = 0;
    let finished = 0;

    const worker = async () => {
      while (started < entries.length) {
        const entry = entries[started++];
        const row = await bulkRow(entry);
        exported.push(row);
        appendBulkRow(row);
        finished++;
        bulkProgress.textContent = `${finished} of ${entries.length} looked up`;
      }
    };

    bulkProgress.textContent = `0 of ${entries.length} looked up`;
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, entries.length) }, worker)
    );

    if (exported.length) bulkExport.classList.remove('d-none');
  }

  function toCsv(rows) {
    const columns = ['input', 'domain', 'company', 'source', 'confidence', 'registrar', 'network', 'error'];
    const quote = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    return [columns.join(',')]
      .concat(rows.map((row) => columns.map((column) => quote(row[column])).join(',')))
      .join('\r\n');
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(exported)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'company-lookup.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyDemoMode(enabled) {
    rdapService.setDemoMode(enabled);
    demoHint.classList.toggle('d-none', !enabled);
    localStorageHelper.setItem(RDAP_DEMO_MODE, enabled);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const storedDemoMode = localStorageHelper.getItem(RDAP_DEMO_MODE) === true;
    demoToggle.checked = storedDemoMode;
    applyDemoMode(storedDemoMode);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await runLookup(input.value);
    });

    demoToggle.addEventListener('change', (event) => applyDemoMode(event.target.checked));

    document.querySelectorAll('.sample').forEach((sample) => {
      sample.addEventListener('click', async (event) => {
        event.preventDefault();
        input.value = sample.dataset.value;
        await runLookup(input.value);
      });
    });

    bulkForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const entries = parseList(bulkInput.value).slice(0, BULK_LIMIT);
      if (!entries.length) {
        bulkProgress.textContent = 'Paste at least one email address or domain.';
        return;
      }
      await runBulk(entries);
    });

    bulkExport.addEventListener('click', downloadCsv);
  });
})();
