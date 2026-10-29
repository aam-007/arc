import { rawScore, result, stats } from './engine.js';
export function download(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const f = (n) => (n === null ? '' : n);
export function exportCSV(sem) {
  const rows = [
    [
      'Subject',
      'Code',
      'Credits',
      'Assessment',
      'Score',
      'Maximum',
      'Weight %',
      'Final marks',
      'Grade',
      'Points',
      'Weighted points',
      'Status',
    ],
  ];
  for (const s of sem.subjects) {
    const r = result(s, sem.grading);
    for (const c of s.components)
      rows.push([
        s.name,
        s.code,
        s.credits,
        c.name,
        f(rawScore(c)),
        c.max,
        c.weight,
        f(r.value),
        r.grade?.label || '',
        r.grade?.points ?? '',
        f(r.weighted),
        r.complete ? 'Complete' : 'Pending',
      ]);
  }
  download(
    'ARC-semester-' + sem.number + '.csv',
    '\ufeff' +
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@-]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(','),
        )
        .join('\r\n'),
    'text/csv;charset=utf-8',
  );
}
const xml = (s) =>
  String(s).replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  );
const text = (ref, s) =>
  `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(s)}</t></is></c>`;
const val = (ref, n) => (n === null || n === undefined ? '' : `<c r="${ref}"><v>${n}</v></c>`);
const formula = (ref, exp, cache, string = false) =>
  `<c r="${ref}"${string ? ' t="str"' : ''}><f>${xml(exp)}</f><v>${xml(cache ?? '')}</v></c>`;
const row = (i, cells) => `<row r="${i}">${cells.join('')}</row>`;
const sheet = (rows) =>
  `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="24" customWidth="1"/><col min="3" max="14" width="16" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData></worksheet>`;
export function workbookFiles(sem) {
  let components = [
      row(
        1,
        [
          'Subject',
          'Assessment',
          'Score (blank = pending)',
          'Maximum',
          'Weight %',
          'Quiz 1',
          'Quiz 2',
          'Contribution / 100',
        ].map((s, i) => text(String.fromCharCode(65 + i) + '1', s)),
      ),
    ],
    subjects = [
      row(
        1,
        [
          'Subject',
          'Code',
          'Credits',
          'Final / 100',
          'Grade',
          'Points',
          'Weighted points',
          'Eligible credits',
          'Status',
        ].map((s, i) => text(String.fromCharCode(65 + i) + '1', s)),
      ),
    ],
    scales = [
      row(
        1,
        [
          'Subject / default',
          'Minimum marks',
          'Grade',
          'Points',
          'Pass marks',
          'Maximum points',
          'Rounding',
          'Credit eligibility',
        ].map((s, i) => text(String.fromCharCode(65 + i) + '1', s)),
      ),
    ];
  let ci = 2,
    gi = 2;
  const cfgRefs = new Map();
  for (const [id, g] of [
    ['default', sem.grading],
    ...sem.subjects.filter((x) => x.grading).map((x) => [x.id, x.grading]),
  ]) {
    const refs = [];
    for (const b of [...g.scale].sort((a, b) => a.min - b.min)) {
      const i = gi++;
      scales.push(
        row(i, [
          text('A' + i, id),
          val('B' + i, b.min),
          text('C' + i, b.label),
          val('D' + i, b.points),
          val('E' + i, g.pass),
          val('F' + i, g.maxPoints),
          text('G' + i, g.round),
          text('H' + i, g.eligible),
        ]),
      );
      refs.push(i);
    }
    cfgRefs.set(id, refs);
  }
  sem.subjects.forEach((s, index) => {
    let refs = [];
    for (const c of s.components) {
      const i = ci++;
      refs.push(i);
      let cells = [
        text('A' + i, s.name),
        text('B' + i, c.name),
        val('D' + i, c.max),
        val('E' + i, c.weight),
      ];
      if (c.average) {
        cells.push(
          val('F' + i, c.scores[0]),
          val('G' + i, c.scores[1]),
          formula(
            'C' + i,
            `IF(COUNT(F${i}:G${i})<2,"",${c.ceil2 ? 'ROUNDUP(' : ''}AVERAGE(F${i}:G${i})${c.ceil2 ? ',2)' : ''})`,
            rawScore(c) ?? '',
            rawScore(c) === null,
          ),
        );
      } else cells.push(val('C' + i, c.score));
      cells.push(
        formula(
          'H' + i,
          `IF(COUNT(C${i})=0,"",C${i}/D${i}*E${i})`,
          rawScore(c) === null ? '' : (rawScore(c) / c.max) * c.weight,
          rawScore(c) === null,
        ),
      );
      components.push(row(i, cells));
    }
    const i = index + 2,
      r = result(s, sem.grading),
      g = s.grading || sem.grading,
      gr = cfgRefs.get(s.grading ? s.id : 'default');
    const count = refs.map((j) => `COUNT(Assessments!C${j})`).join('+') || '0';
    let final = `SUM(${refs.map((j) => `Assessments!H${j}`).join(',')})`;
    let points = '0',
      label = '"Below pass"';
    for (const j of gr) {
      points = `IF(D${i}>=Grading!B${j},Grading!D${j},${points})`;
      label = `IF(D${i}>=Grading!B${j},Grading!C${j},${label})`;
    }
    points = `IF(D${i}<Grading!E${gr[0]},0,${points})`;
    const graded =
      g.round === 'none'
        ? `D${i}`
        : `${g.round === 'nearest' ? 'ROUND' : g.round === 'floor' ? 'ROUNDDOWN' : 'ROUNDUP'}(D${i},0)`;
    points = points.replaceAll(`D${i}<`, `${graded}<`).replaceAll(`D${i}>=`, `${graded}>=`);
    label = label.replaceAll(`D${i}>=`, `${graded}>=`);
    const pointsExp = `IF(COUNT(D${i})=0,"",${points})`;
    subjects.push(
      row(i, [
        text('A' + i, s.name),
        text('B' + i, s.code),
        val('C' + i, +s.credits),
        formula('D' + i, `IF(${count}<${refs.length},"",${final})`, r.value ?? '', !r.complete),
        formula('E' + i, `IF(COUNT(D${i})=0,"",${label})`, r.grade?.label ?? '', true),
        formula('F' + i, pointsExp, r.grade?.points ?? '', !r.complete),
        formula('G' + i, `IF(COUNT(F${i})=0,"",F${i}*C${i})`, r.weighted ?? '', !r.complete),
        formula(
          'H' + i,
          `IF(COUNT(F${i})=0,0,${sem.grading.eligible === 'passed' ? `IF(F${i}>0,C${i},0)` : `C${i}`})`,
          r.grade && (sem.grading.eligible !== 'passed' || r.grade.points > 0) ? +s.credits : 0,
        ),
        formula(
          'I' + i,
          `IF(COUNT(D${i})=0,"Pending","Complete")`,
          r.complete ? 'Complete' : 'Pending',
          true,
        ),
      ]),
    );
  });
  let last = sem.subjects.length + 1,
    summary = last + 3,
    t = stats(sem);
  subjects.push(
    row(summary, [
      text('A' + summary, 'Registered credits'),
      formula('C' + summary, last > 1 ? `SUM(C2:C${last})` : '0', t.credits),
    ]),
  );
  subjects.push(
    row(summary + 1, [
      text('A' + (summary + 1), 'Official semester GPA'),
      formula(
        'F' + (summary + 1),
        last > 1
          ? `IF(COUNT(D2:D${last})<${sem.subjects.length},"Pending",IF(SUM(H2:H${last})=0,"Pending",SUM(G2:G${last})/SUM(H2:H${last})))`
          : '"Pending"',
        t.official && t.gpa !== null ? t.gpa : 'Pending',
        !t.official || t.gpa === null,
      ),
    ]),
  );
  return {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      [1, 2, 3]
        .map(
          (i) =>
            `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      '</Types>',
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      ['Subjects', 'Assessments', 'Grading']
        .map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('') +
      '</sheets><calcPr fullCalcOnLoad="1"/></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      [1, 2, 3]
        .map(
          (i) =>
            `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`,
        )
        .join('') +
      '</Relationships>',
    'xl/worksheets/sheet1.xml': sheet(subjects),
    'xl/worksheets/sheet2.xml': sheet(components),
    'xl/worksheets/sheet3.xml': sheet(scales),
  };
}
// Standards-based uncompressed ZIP keeps spreadsheet exports dependency-free offline.
export function zip(files) {
  const encoder = new TextEncoder(),
    parts = [],
    central = [];
  let offset = 0;
  const u16 = (v, n, o) => v.setUint16(o, n, true),
    u32 = (v, n, o) => v.setUint32(o, n >>> 0, true);
  function crc(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  for (const [name, body] of Object.entries(files)) {
    const n = encoder.encode(name),
      b = encoder.encode(body),
      checksum = crc(b),
      h = new Uint8Array(30 + n.length),
      v = new DataView(h.buffer);
    u32(v, 0x04034b50, 0);
    u16(v, 20, 4);
    u32(v, checksum, 14);
    u32(v, b.length, 18);
    u32(v, b.length, 22);
    u16(v, n.length, 26);
    h.set(n, 30);
    parts.push(h, b);
    const ch = new Uint8Array(46 + n.length),
      cv = new DataView(ch.buffer);
    u32(cv, 0x02014b50, 0);
    u16(cv, 20, 4);
    u16(cv, 20, 6);
    u32(cv, checksum, 16);
    u32(cv, b.length, 20);
    u32(cv, b.length, 24);
    u16(cv, n.length, 28);
    u32(cv, offset, 42);
    ch.set(n, 46);
    central.push(ch);
    offset += h.length + b.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0),
    end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  u32(ev, 0x06054b50, 0);
  u16(ev, central.length, 8);
  u16(ev, central.length, 10);
  u32(ev, size, 12);
  u32(ev, offset, 16);
  return new Blob([...parts, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
export function exportExcel(sem) {
  download(
    'ARC-semester-' + sem.number + '.xlsx',
    zip(workbookFiles(sem)),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}
