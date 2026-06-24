// lib/dropdown.js
// Reusable dropdown component. Every select in the app is built through this.
// Source: Developer Prompt §8 — "Every dropdown is built by the reusable lib/dropdown.js component."

/**
 * Populate a <select> element from a master array.
 * @param {object} opts
 * @param {HTMLSelectElement} opts.el - The <select> element to populate.
 * @param {Array} opts.master - Array of master objects.
 * @param {string} opts.valueField - Field name to use as option value.
 * @param {string} opts.labelField - Field name to use as option label.
 * @param {function} [opts.filter] - Optional filter function (row) => boolean.
 * @param {*} [opts.selected] - Initial selected value.
 * @param {boolean} [opts.includeBlank=true] - Whether to include a blank "—select—" option.
 */
export function populateDropdown({ el, master, valueField, labelField, filter, selected, includeBlank = true }) {
  el.innerHTML = '';
  if (includeBlank) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— select —';
    el.appendChild(blank);
  }

  const rows = filter ? master.filter(filter) : master;
  rows.forEach(row => {
    const opt = document.createElement('option');
    opt.value = row[valueField];
    opt.textContent = row[labelField];
    if (row[valueField] === selected) opt.selected = true;
    el.appendChild(opt);
  });
}

/**
 * Create and return a new <select> element populated from a master.
 * Identical to populateDropdown but creates the element instead of populating an existing one.
 * @param {object} opts - Same as populateDropdown.
 * @returns {HTMLSelectElement}
 */
export function createDropdown({ master, valueField, labelField, filter, selected, includeBlank = true, onChange } = {}) {
  const el = document.createElement('select');
  el.className = 'form-select';
  populateDropdown({ el, master, valueField, labelField, filter, selected, includeBlank });
  if (onChange) el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

/**
 * Get the selected row object from a dropdown.
 * @param {HTMLSelectElement} el
 * @param {Array} master
 * @param {string} valueField
 * @returns {object|null}
 */
export function selectedRow(el, master, valueField) {
  const v = el.value;
  if (!v) return null;
  return master.find(r => String(r[valueField]) === String(v)) ?? null;
}

/**
 * Mount a search-as-you-type combobox inside `container`.
 * Shows a text input; renders up to 50 filtered matches in a dropdown.
 * The hidden input (named `name`) holds the actual value for FormData.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container   - Element to render into (cleared first).
 * @param {string}      opts.name        - Name attribute for the hidden value input.
 * @param {{ value: string, label: string }[]} opts.items - Full option list.
 * @param {string|null} [opts.selected]  - Pre-selected value.
 * @param {string}      [opts.placeholder]
 */
export function mountCombobox({ container, name, items, selected = null, placeholder = 'Search…', disabled = false }) {
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  const initItem = selected ? items.find(it => it.value === selected) : null;

  container.innerHTML = `
    <input type="text" class="combobox-input" autocomplete="off"
      placeholder="${esc(placeholder)}" value="${esc(initItem?.label ?? '')}"
      style="width:100%"${disabled ? ' disabled' : ''}>
    <input type="hidden" class="combobox-value" name="${esc(name)}" value="${esc(initItem?.value ?? '')}"
      data-label="${esc(initItem?.label ?? '')}">
    <div class="combobox-dropdown" style="display:none;position:absolute;left:0;right:0;z-index:300;
      background:var(--color-surface,#1e2235);border:1px solid var(--border,#2e3350);
      border-radius:0 0 6px 6px;max-height:260px;overflow-y:auto;
      box-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:none"></div>
  `;
  container.style.position = 'relative';

  if (disabled) return;

  const textEl   = container.querySelector('.combobox-input');
  const hiddenEl = container.querySelector('input.combobox-value');
  const dropEl   = container.querySelector('.combobox-dropdown');
  let activeIdx  = -1;
  let lastLabel  = initItem?.label ?? '';   // tracks the label of the currently confirmed selection

  function renderOptions(query) {
    const q = (query ?? '').toLowerCase().trim();
    const matches = q
      ? items.filter(it => (it.searchText ?? it.label).toLowerCase().includes(q)).slice(0, 50)
      : items.slice(0, 50);
    activeIdx = -1;
    if (!matches.length) {
      dropEl.innerHTML = '<div style="padding:8px 12px;color:var(--color-text-muted,#8892a4);font-size:13px">No matches</div>';
    } else {
      dropEl.innerHTML = matches.map(it =>
        `<div class="combobox-option" data-value="${esc(it.value)}" data-label="${esc(it.label)}"
          style="padding:8px 12px;cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto"
          >${esc(it.label)}</div>`
      ).join('');
      dropEl.querySelectorAll('.combobox-option').forEach(el => {
        el.addEventListener('mousedown', e => { e.preventDefault(); selectItem(el.dataset.value, el.dataset.label); });
      });
    }
    dropEl.style.display = 'block';
  }

  function selectItem(value, label) {
    lastLabel = label ?? '';
    hiddenEl.value = value ?? '';
    hiddenEl.dataset.label = label ?? '';
    textEl.value   = label ?? '';
    dropEl.style.display = 'none';
    activeIdx = -1;
    hiddenEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function highlight() {
    dropEl.querySelectorAll('.combobox-option').forEach((el, i) => {
      el.style.background = i === activeIdx ? 'var(--accent,#6c8ebf)' : '';
      el.style.color = i === activeIdx ? '#fff' : '';
    });
  }

  textEl.addEventListener('input', () => renderOptions(textEl.value));
  textEl.addEventListener('focus', () => { textEl.select(); renderOptions(''); });
  textEl.addEventListener('click', () => { textEl.select(); renderOptions(''); });
  textEl.addEventListener('blur', () => {
    dropEl.style.display = 'none';
    activeIdx = -1;
    if (!textEl.value.trim()) {
      hiddenEl.value = '';
      lastLabel = '';
    } else {
      textEl.value = lastLabel; // restore confirmed selection label if user typed but didn't pick
    }
  });
  textEl.addEventListener('keydown', e => {
    const opts = [...dropEl.querySelectorAll('.combobox-option')];
    if (e.key === 'ArrowDown') {
      e.preventDefault(); activeIdx = Math.min(activeIdx + 1, opts.length - 1); highlight();
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlight();
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) selectItem(opts[activeIdx].dataset.value, opts[activeIdx].dataset.label);
    } else if (e.key === 'Escape') {
      dropEl.style.display = 'none';
    }
  });
}
