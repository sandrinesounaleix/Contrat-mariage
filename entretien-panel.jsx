// entretien-panel.jsx
// Panneau latéral pour saisir les éléments d'un entretien mariage
// et auto-remplir le contrat IMAZIA × OJUNIX en temps réel.
// Persistence : localStorage + export/import JSON. Toggle via le bouton flottant
// ou via la barre d'outils (protocole __edit_mode_available).

const STORAGE_KEY = 'imazia-contract-data-v1';
const REF_KEY = 'imazia-ref-counter';

// ─── Référentiels ─────────────────────────────────────────────────────────
const FORMULES = {
  opale:   { code: 'opale',   name: 'Opale',   price: 1150, photographes: 1, sub: 'Essentielle' },
  saphir:  { code: 'saphir',  name: 'Saphir',  price: 1650, photographes: 2, sub: 'Journée' },
  ruby:    { code: 'ruby',    name: 'Ruby',    price: 2050, photographes: 2, sub: 'Variante A ou B' },
  diamant: { code: 'diamant', name: 'Diamant', price: 2550, photographes: 2, sub: 'Intégrale' },
};

const SOURCES = [
  { code: 'bouche',     label: 'Bouche à oreille' },
  { code: 'mariages',   label: 'Mariages.net' },
  { code: 'google',     label: 'Google' },
  { code: 'instagram',  label: 'Instagram' },
  { code: 'autre',      label: 'Autre' },
];

const HORAIRES_DEFS = [
  { key: 'prepMari',        label: 'Préparatifs (Monsieur / Marié·e 1)' },
  { key: 'prepMariee',      label: 'Préparatifs (Madame / Marié·e 2)' },
  { key: 'cerCivile',       label: 'Cérémonie civile' },
  { key: 'cerReligieuse',   label: 'Cérémonie religieuse / laïque' },
  { key: 'portraitsCouple', label: 'Portraits de couple' },
  { key: 'portraitsGroupe', label: 'Portraits de groupe' },
  { key: 'vinHonneur',      label: 'Vin d\'honneur' },
  { key: 'dinerSoiree',     label: 'Dîner / soirée' },
  { key: 'autreEtape',      label: 'Autre étape' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
function peekRefCounter() {
  return parseInt(localStorage.getItem(REF_KEY) || '0', 10);
}
function consumeNextRef() {
  const year = new Date().getFullYear();
  const c = peekRefCounter() + 1;
  localStorage.setItem(REF_KEY, String(c));
  return `M-${year}-${String(c).padStart(3, '0')}`;
}

function defaultData() {
  return {
    reference: '',
    dateContrat: new Date().toISOString().slice(0, 10),
    lieuContrat: 'Limoges',
    marie1: { nom: '', prenom: '', mobile: '', adresse: '', cp: '', ville: '', email: '' },
    marie2: { nom: '', prenom: '', mobile: '', adresse: '', cp: '', ville: '', email: '' },
    source: '',
    sourceAutre: '',
    dateMariage: '',
    nbInvites: '',
    lieuxPrincipaux: '',
    formule: '',
    varianteRuby: 'A',
    optionMairie: false,
    heuresSup: 0,
    kmExtra: 0,
    remise: 0,
    remiseType: 'euros',
    horaires: HORAIRES_DEFS.reduce((acc, h) => {
      acc[h.key] = { debut: '', fin: '', adresse: '', comment: '' };
      return acc;
    }, {}),
    notes: '',
  };
}

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setByPath(obj, path, value) {
  const keys = path.split('.');
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...cur[keys[i]] };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
function formatEUR(n) {
  return (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €';
}
function formatDateFR(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function computeTotals(d) {
  const formule = FORMULES[d.formule];
  const base = formule ? formule.price : 0;
  const mairie = d.optionMairie ? 300 : 0;
  const sup = (Number(d.heuresSup) || 0) * 250;
  const km = Math.max(0, Number(d.kmExtra) || 0) * 0.70;
  const subtotal = base + mairie + sup + km;
  const remiseVal = Math.max(0, Number(d.remise) || 0);
  const remise = d.remiseType === 'pourcent'
    ? subtotal * Math.min(remiseVal, 100) / 100
    : Math.min(remiseVal, subtotal);
  const total = subtotal - remise;
  const acompte = total * 0.30;
  return { base, mairie, sup, km, remise, subtotal, total, acompte, solde: total - acompte };
}

// ─── DOM apply ────────────────────────────────────────────────────────────
function applyDataToDOM(d) {
  const totals = computeTotals(d);
  const mariesSummary = [d.marie1, d.marie2]
    .map(m => `${(m.prenom || '').trim()} ${(m.nom || '').trim()}`.trim())
    .filter(Boolean)
    .join(' & ');

  // Derived (computed) values
  const derived = {
    'derived.mariesSummary':  mariesSummary,
    'derived.dateMariageFR':  formatDateFR(d.dateMariage),
    'derived.dateContratFR':  formatDateFR(d.dateContrat),
    'derived.formuleName':    FORMULES[d.formule]?.name || '',
    'derived.formuleSub':     FORMULES[d.formule] ? (
      `${FORMULES[d.formule].photographes} photographe${FORMULES[d.formule].photographes > 1 ? 's' : ''} · ${FORMULES[d.formule].sub}${d.formule === 'ruby' && d.varianteRuby ? ` (variante ${d.varianteRuby})` : ''}`
    ) : '',
    'derived.totalFormuleEUR': d.formule ? formatEUR(totals.base) : '',
    'derived.totalMairieEUR':  d.optionMairie ? '300 €' : '',
    'derived.totalHsupEUR':    totals.sup > 0 ? formatEUR(totals.sup) : '',
    'derived.totalKmEUR':      totals.km > 0 ? formatEUR(totals.km) : '',
    'derived.remiseEUR':       totals.remise > 0 ? '- ' + formatEUR(totals.remise) : '',
    'derived.totalTtcEUR':     totals.total > 0 ? formatEUR(totals.total) : '',
    'derived.acompteEUR':      totals.total > 0 ? formatEUR(totals.acompte) : '',
    'derived.heuresSupHr':     totals.sup > 0 ? `${d.heuresSup} h` : '',
    'derived.kmExtraKm':       (Number(d.kmExtra) || 0) > 0 ? `${d.kmExtra} km au-delà` : '',
    'derived.sourceLabel':     (() => {
      if (d.source === 'autre') return d.sourceAutre || '';
      return SOURCES.find(s => s.code === d.source)?.label || '';
    })(),
  };

  const formatters = {
    'dateMariage':       formatDateFR,
    'dateContrat':       formatDateFR,
    'nbInvites':         v => v ? `${v} invité·e·s` : '',
  };

  document.querySelectorAll('[data-field]').forEach(el => {
    const path = el.dataset.field;
    let raw = path.startsWith('derived.') ? derived[path] : getByPath(d, path);
    const fmt = formatters[path];
    const value = fmt ? fmt(raw) : raw;
    const filled = value !== undefined && value !== null && value !== '' && value !== false;

    const row = el.closest('[data-row]');
    if (row) row.style.display = filled ? '' : 'none';

    if (el.classList.contains('line')) {
      // Dotted line in a .field/.line-fill style
      el.innerHTML = filled ? `<span class="val">${escapeHtml(value)}</span>` : '';
      if (el.parentElement && el.parentElement.classList.contains('field')) {
        el.parentElement.classList.toggle('filled', filled);
      }
    } else if (el.classList.contains('line-fill')) {
      el.textContent = filled ? value : '';
      el.classList.toggle('filled', filled);
    } else {
      // Inline span
      const placeholder = el.dataset.placeholder ?? '';
      el.textContent = filled ? value : placeholder;
      el.classList.toggle('is-filled', filled);
    }
  });

  // Source chips
  document.querySelectorAll('.source-row .chip[data-source]').forEach(chip => {
    chip.classList.toggle('on', chip.dataset.source === d.source);
  });

  // Formule cards
  document.querySelectorAll('.col-card[data-formule]').forEach(card => {
    const isSelected = card.dataset.formule === d.formule;
    card.classList.toggle('featured', isSelected);
    const pickLabel = card.querySelector('.pick > span:first-child');
    if (pickLabel) pickLabel.textContent = isSelected ? 'Sélectionnée' : 'Je choisis';
  });

  // Ruby variant indicator
  document.querySelectorAll('[data-ruby-variant]').forEach(el => {
    el.classList.toggle('ruby-active', el.dataset.rubyVariant === d.varianteRuby && d.formule === 'ruby');
  });

  // Option Mairie row in opt-card
  document.querySelectorAll('[data-option="mairie"]').forEach(el => {
    el.classList.toggle('opt-checked', !!d.optionMairie);
  });
}

// ─── Persistence ──────────────────────────────────────────────────────────
function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveStored(d) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
}

// ─── UI atoms ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <label className="ep-field">
      <span className="ep-label">{label}{hint && <em className="ep-hint">{hint}</em>}</span>
      {children}
    </label>
  );
}
function TextInput({ value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <input
      className="ep-input"
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      {...rest}
    />
  );
}
function NumInput({ value, onChange, min, max, step = 1, suffix }) {
  return (
    <div className="ep-num">
      <input
        type="number"
        value={value === 0 ? 0 : (value ?? '')}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span className="ep-suffix">{suffix}</span>}
    </div>
  );
}
function Select({ value, onChange, options, placeholder = '—' }) {
  return (
    <select className="ep-input ep-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
function Toggle({ value, onChange, label }) {
  return (
    <button type="button" className={'ep-toggle' + (value ? ' on' : '')} onClick={() => onChange(!value)}>
      <span className="ep-toggle-dot" />
      <span>{label}</span>
    </button>
  );
}
function SectionHeader({ children, open, onToggle }) {
  return (
    <div className={'ep-section' + (open ? ' open' : '')} onClick={onToggle}>
      <span>{children}</span>
      <span className="ep-chev">{open ? '–' : '+'}</span>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────
function EntretienPanel() {
  const [data, setData] = React.useState(() => {
    const stored = loadStored();
    if (stored) return { ...defaultData(), ...stored };
    const fresh = defaultData();
    fresh.reference = consumeNextRef();
    return fresh;
  });
  const [open, setOpen] = React.useState(false);
  const [openSections, setOpenSections] = React.useState({
    contrat: true, maries: true, mariage: true, formule: true, horaires: false, notes: false, data: false,
  });
  const [importErr, setImportErr] = React.useState('');
  const fileInputRef = React.useRef(null);

  // Apply on change
  React.useEffect(() => {
    applyDataToDOM(data);
    saveStored(data);
  }, [data]);

  // Toolbar toggle protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const set = (path, value) => setData(prev => setByPath(prev, path, value));
  const toggleSection = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  const totals = computeTotals(data);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ref = data.reference || 'contrat';
    const couple = [data.marie1.nom, data.marie2.nom].filter(Boolean).join('-') || 'mariage';
    a.href = url;
    a.download = `${ref}-${couple}.json`.toLowerCase().replace(/\s+/g, '-');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setData({ ...defaultData(), ...parsed });
        setImportErr('');
      } catch (err) {
        setImportErr('Fichier JSON invalide.');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  };
  const handleNew = () => {
    if (!confirm('Démarrer un nouveau contrat ? Les données actuelles seront effacées (pensez à exporter d\'abord).')) return;
    const fresh = defaultData();
    fresh.reference = consumeNextRef();
    setData(fresh);
  };
  const handlePrint = () => window.print();

  const handleMail = () => {
    const totals = computeTotals(data);
    const prenoms = [data.marie1.prenom, data.marie2.prenom].filter(Boolean).join(' & ') || 'Les Mariés';
    const formule = FORMULES[data.formule];
    const dateMariageStr = formatDateFR(data.dateMariage) || 'à confirmer';

    const lines = [
      `Bonjour ${prenoms},`,
      '',
      `Suite à notre échange, vous trouverez ci-joint le contrat de reportage photographique pour votre mariage du ${dateMariageStr}.`,
      '',
      'Voici un récapitulatif :',
      data.reference ? `• Référence du contrat : ${data.reference}` : null,
      formule ? `• Formule retenue : ${formule.name} (${formule.photographes} photographe${formule.photographes > 1 ? 's' : ''})${data.formule === 'ruby' ? ` — variante ${data.varianteRuby}` : ''}` : null,
      data.optionMairie ? '• Option Mairie : oui (+ 300 €)' : null,
      Number(data.heuresSup) > 0 ? `• Heures supplémentaires : ${data.heuresSup} h` : null,
      Number(data.kmExtra) > 0 ? `• Déplacement au-delà de 100 km : ${data.kmExtra} km` : null,
      totals.total > 0 ? `• Total H.T. : ${formatEUR(totals.total)} (TVA non applicable, art. 293 B du CGI)` : null,
      totals.total > 0 ? `• Acompte 30 % à la signature : ${formatEUR(totals.acompte)}` : null,
      totals.total > 0 ? `• Solde 70 % le jour J : ${formatEUR(totals.solde)}` : null,
      '',
      'Pour valider votre réservation, merci de :',
      '1. Relire le contrat (les 4 pages)',
      '2. Le signer avec la mention manuscrite « Lu et approuvé, bon pour commande conforme au contrat »',
      '3. Nous retourner un exemplaire signé accompagné de l\'acompte de 30 %',
      '',
      'Restant à votre disposition pour toute question.',
      '',
      'À très vite,',
      'Sandrine Sounaleix (Imazia) & Julie Salles (Ojunix)',
      'imaziaphoto.fr · ojunix.fr',
    ].filter(l => l !== null);

    const body = lines.join('\r\n');
    const subject = `Contrat reportage mariage — ${data.reference || 'IMAZIA × OJUNIX'}${data.dateMariage ? ' · ' + dateMariageStr : ''}`;
    const to = encodeURIComponent([data.marie1.email, data.marie2.email].filter(Boolean).join(','));
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Trigger via temporary link (more reliable than location.href in some browsers)
    const a = document.createElement('a');
    a.href = mailto;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  return (
    <>
      {!open && (
        <button type="button" className="ep-fab no-print" onClick={() => setOpen(true)} aria-label="Ouvrir l'entretien">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h16M4 12h16M4 19h10" />
          </svg>
          <span>Entretien</span>
        </button>
      )}

      {open && (
        <aside className="ep-panel no-print" data-omelette-chrome="">
          <header className="ep-hd">
            <div>
              <div className="ep-hd-ttl">Entretien · Saisie</div>
              <div className="ep-hd-sub">{data.reference || 'Nouveau contrat'}</div>
            </div>
            <button type="button" className="ep-x" onClick={dismiss} aria-label="Fermer">✕</button>
          </header>

          <div className="ep-body">

            {/* RÉFÉRENCE & CONTRAT */}
            <SectionHeader open={openSections.contrat} onToggle={() => toggleSection('contrat')}>
              Référence du contrat
            </SectionHeader>
            {openSections.contrat && (
              <div className="ep-grp">
                <Field label="Référence"><TextInput value={data.reference} onChange={v => set('reference', v)} /></Field>
                <div className="ep-row-2">
                  <Field label="Date du contrat"><TextInput type="date" value={data.dateContrat} onChange={v => set('dateContrat', v)} /></Field>
                  <Field label="Fait à"><TextInput value={data.lieuContrat} onChange={v => set('lieuContrat', v)} placeholder="Limoges" /></Field>
                </div>
              </div>
            )}

            {/* MARIÉS */}
            <SectionHeader open={openSections.maries} onToggle={() => toggleSection('maries')}>
              Les marié·e·s
            </SectionHeader>
            {openSections.maries && (
              <div className="ep-grp">
                <div className="ep-marie-block">
                  <div className="ep-marie-ttl">Marié·e 1</div>
                  <div className="ep-row-2">
                    <Field label="Nom"><TextInput value={data.marie1.nom} onChange={v => set('marie1.nom', v)} /></Field>
                    <Field label="Prénom"><TextInput value={data.marie1.prenom} onChange={v => set('marie1.prenom', v)} /></Field>
                  </div>
                  <Field label="Adresse"><TextInput value={data.marie1.adresse} onChange={v => set('marie1.adresse', v)} placeholder="12 rue …" /></Field>
                  <div className="ep-row-2">
                    <Field label="Code postal"><TextInput value={data.marie1.cp} onChange={v => set('marie1.cp', v)} /></Field>
                    <Field label="Localité"><TextInput value={data.marie1.ville} onChange={v => set('marie1.ville', v)} /></Field>
                  </div>
                  <div className="ep-row-2">
                    <Field label="Mobile"><TextInput type="tel" value={data.marie1.mobile} onChange={v => set('marie1.mobile', v)} /></Field>
                    <Field label="E-mail"><TextInput type="email" value={data.marie1.email} onChange={v => set('marie1.email', v)} /></Field>
                  </div>
                </div>

                <div className="ep-marie-block">
                  <div className="ep-marie-ttl">Marié·e 2</div>
                  <div className="ep-row-2">
                    <Field label="Nom"><TextInput value={data.marie2.nom} onChange={v => set('marie2.nom', v)} /></Field>
                    <Field label="Prénom"><TextInput value={data.marie2.prenom} onChange={v => set('marie2.prenom', v)} /></Field>
                  </div>
                  <Field label="Adresse"><TextInput value={data.marie2.adresse} onChange={v => set('marie2.adresse', v)} placeholder="12 rue …" /></Field>
                  <div className="ep-row-2">
                    <Field label="Code postal"><TextInput value={data.marie2.cp} onChange={v => set('marie2.cp', v)} /></Field>
                    <Field label="Localité"><TextInput value={data.marie2.ville} onChange={v => set('marie2.ville', v)} /></Field>
                  </div>
                  <div className="ep-row-2">
                    <Field label="Mobile"><TextInput type="tel" value={data.marie2.mobile} onChange={v => set('marie2.mobile', v)} /></Field>
                    <Field label="E-mail"><TextInput type="email" value={data.marie2.email} onChange={v => set('marie2.email', v)} /></Field>
                  </div>
                </div>

                <Field label="Vous nous avez connues —">
                  <Select
                    value={data.source}
                    onChange={v => set('source', v)}
                    options={SOURCES.map(s => ({ value: s.code, label: s.label }))}
                  />
                </Field>
                {data.source === 'autre' && (
                  <Field label="Préciser"><TextInput value={data.sourceAutre} onChange={v => set('sourceAutre', v)} /></Field>
                )}
              </div>
            )}

            {/* MARIAGE */}
            <SectionHeader open={openSections.mariage} onToggle={() => toggleSection('mariage')}>
              Le mariage
            </SectionHeader>
            {openSections.mariage && (
              <div className="ep-grp">
                <div className="ep-row-2">
                  <Field label="Date du mariage"><TextInput type="date" value={data.dateMariage} onChange={v => set('dateMariage', v)} /></Field>
                  <Field label="Nombre d'invités"><NumInput value={data.nbInvites} onChange={v => set('nbInvites', v)} min={0} /></Field>
                </div>
                <Field label="Lieu(x) principal(aux)"><TextInput value={data.lieuxPrincipaux} onChange={v => set('lieuxPrincipaux', v)} placeholder="Château de …" /></Field>
              </div>
            )}

            {/* FORMULE */}
            <SectionHeader open={openSections.formule} onToggle={() => toggleSection('formule')}>
              Formule & options
            </SectionHeader>
            {openSections.formule && (
              <div className="ep-grp">
                <div className="ep-formules">
                  {Object.values(FORMULES).map(f => (
                    <button
                      key={f.code}
                      type="button"
                      className={'ep-formule' + (data.formule === f.code ? ' on' : '')}
                      onClick={() => set('formule', f.code)}
                    >
                      <span className="nm">{f.name}</span>
                      <span className="pr">{f.price} €</span>
                      <span className="ph">{f.photographes} photographe{f.photographes > 1 ? 's' : ''}</span>
                    </button>
                  ))}
                </div>
                {data.formule === 'ruby' && (
                  <Field label="Variante Ruby">
                    <div className="ep-seg">
                      {['A', 'B'].map(v => (
                        <button
                          key={v}
                          type="button"
                          className={'ep-seg-btn' + (data.varianteRuby === v ? ' on' : '')}
                          onClick={() => set('varianteRuby', v)}
                        >
                          {v}. {v === 'A' ? 'Préparatifs' : 'Repas + bal'}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <Toggle value={data.optionMairie} onChange={v => set('optionMairie', v)} label="Option Mairie (+ 300 €)" />
                <div className="ep-row-2">
                  <Field label="Heures sup." hint="250 €/h"><NumInput value={data.heuresSup} onChange={v => set('heuresSup', v || 0)} min={0} step={1} suffix="h" /></Field>
                  <Field label="Km > 100" hint="0,70 €/km"><NumInput value={data.kmExtra} onChange={v => set('kmExtra', v || 0)} min={0} step={10} suffix="km" /></Field>
                </div>

                <Field label="Remise">
                  <div className="ep-seg">
                    {[{v:'euros',l:'€'},{v:'pourcent',l:'%'}].map(o => (
                      <button key={o.v} type="button" className={'ep-seg-btn' + (data.remiseType === o.v ? ' on' : '')} onClick={() => set('remiseType', o.v)}>{o.l}</button>
                    ))}
                  </div>
                </Field>
                <NumInput value={data.remise} onChange={v => set('remise', v || 0)} min={0} step={data.remiseType === 'pourcent' ? 1 : 10} suffix={data.remiseType === 'pourcent' ? '%' : '€'} />

                <div className="ep-totals">
                  {totals.base > 0 && <div className="row"><span>Formule {FORMULES[data.formule].name}</span><strong>{formatEUR(totals.base)}</strong></div>}
                  {totals.mairie > 0 && <div className="row"><span>Option Mairie</span><strong>{formatEUR(totals.mairie)}</strong></div>}
                  {totals.sup > 0 && <div className="row"><span>Heures sup. ({data.heuresSup}h)</span><strong>{formatEUR(totals.sup)}</strong></div>}
                  {totals.km > 0 && <div className="row"><span>Frais km ({data.kmExtra} km)</span><strong>{formatEUR(totals.km)}</strong></div>}
                  {totals.remise > 0 && <div className="row"><span>Remise</span><strong>− {formatEUR(totals.remise)}</strong></div>}
                  <div className="row total"><span>Total H.T.</span><strong>{formatEUR(totals.total)}</strong></div>
                  <div className="row sub"><span>Acompte 30 % (signature)</span><strong>{formatEUR(totals.acompte)}</strong></div>
                  <div className="row sub"><span>Solde 70 % (jour J)</span><strong>{formatEUR(totals.solde)}</strong></div>
                </div>
              </div>
            )}

            {/* HORAIRES */}
            <SectionHeader open={openSections.horaires} onToggle={() => toggleSection('horaires')}>
              Déroulement de la journée
            </SectionHeader>
            {openSections.horaires && (
              <div className="ep-grp">
                {HORAIRES_DEFS.map(h => (
                  <div key={h.key} className="ep-horaire">
                    <div className="ep-horaire-ttl">{h.label}</div>
                    <div className="ep-row-2">
                      <Field label="Début"><TextInput type="time" value={data.horaires[h.key].debut} onChange={v => set(`horaires.${h.key}.debut`, v)} /></Field>
                      <Field label="Fin"><TextInput type="time" value={data.horaires[h.key].fin} onChange={v => set(`horaires.${h.key}.fin`, v)} /></Field>
                    </div>
                    <Field label="Adresse"><TextInput value={data.horaires[h.key].adresse} onChange={v => set(`horaires.${h.key}.adresse`, v)} /></Field>
                    <Field label="Commentaire"><TextInput value={data.horaires[h.key].comment} onChange={v => set(`horaires.${h.key}.comment`, v)} /></Field>
                  </div>
                ))}
              </div>
            )}

            {/* NOTES */}
            <SectionHeader open={openSections.notes} onToggle={() => toggleSection('notes')}>
              Notes & témoins
            </SectionHeader>
            {openSections.notes && (
              <div className="ep-grp">
                <Field label="Notes libres" hint="témoins, surprises, personnes à photographier…">
                  <textarea className="ep-input ep-textarea" rows="5" value={data.notes} onChange={e => set('notes', e.target.value)} />
                </Field>
              </div>
            )}

            {/* DATA */}
            <SectionHeader open={openSections.data} onToggle={() => toggleSection('data')}>
              Sauvegarde & partage
            </SectionHeader>
            {openSections.data && (
              <div className="ep-grp">
                <p className="ep-note">Le contrat est sauvegardé automatiquement dans ce navigateur. Pour le partager avec une collègue, exportez le JSON et envoyez-le.</p>
                <div class="ep-actions">
                  <button type="button" className="ep-btn primary" onClick={handleMail} disabled={!data.marie1.email && !data.marie2.email}>✉ Envoyer par mail</button>
                  <button type="button" className="ep-btn" onClick={handlePrint}>🖨 Imprimer / PDF</button>
                </div>
                {!data.marie1.email && !data.marie2.email && <p className="ep-note tiny" style={{ color: 'rgba(255,200,140,0.7)' }}>→ Renseignez au moins un e-mail pour activer l'envoi.</p>}
                <p className="ep-note tiny">Le bouton ouvre votre messagerie (Mail, Outlook, Gmail…) avec un message pré-rempli. Pensez à générer le PDF avant (bouton Imprimer / PDF) puis à l'attacher à l'e-mail.</p>

                <div className="ep-actions" style={{ marginTop: 6 }}>
                  <button type="button" className="ep-btn primary" onClick={handleExport}>↓ Exporter (.json)</button>
                  <button type="button" className="ep-btn" onClick={handleImportClick}>↑ Importer (.json)</button>
                  <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
                </div>
                {importErr && <div className="ep-err">{importErr}</div>}
                <div className="ep-actions">
                  <button type="button" className="ep-btn danger" onClick={handleNew} style={{ gridColumn: '1 / -1' }}>↺ Nouveau contrat</button>
                </div>
                <p className="ep-note tiny">Référence auto-incrémentée à chaque nouveau contrat. Compteur actuel : {peekRefCounter()}.</p>
              </div>
            )}

          </div>
        </aside>
      )}
    </>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('entretien-root')).render(<EntretienPanel />);
