import { metrics, subjectDistribution, subjectKey } from './grades.mjs';

const domainSubjects = {
  'Lingüístic': [
    'Llengua Catalana i Literatura I', 'Llengua Catalana i Literatura II',
    'Llengua Castellana i Literatura I', 'Llengua Castellana i Literatura II',
    'Llengua Estrangera I: Anglès', 'Llengua Estrangera II: Anglès',
    'Segona llengua estrangera: Alemany', 'Creació literària',
  ],
  'Humanístic': [
    'Filosofia', 'Història de la Filosofia', 'Història', 'Història del Món Contemporani',
    'Llengua i Cultura Llatines I', 'Llengua i Cultura Llatines II',
    'Llengua i Cultura Gregues I', 'Llengua i Cultura Gregues II',
    'Literatura Universal', 'Religió',
  ],
  'Social i econòmic': [
    'Economia', 'Geografia', 'Funcionament de l’empresa', 'Comerç Electrònic', 'Problemàtiques socials',
    'Ciutadania, política i dret', 'Funcionament de l’Empresa i Disseny de Models de Negoci',
    'Matemàtiques Aplicades CS I', 'Matemàtiques Aplicades CS II', 'Itinerari personal per a l’ocupabilitat',
  ],
  'Científic': [
    'Matemàtiques I', 'Matemàtiques II', 'Física', 'Física II', 'Química I', 'Química II',
    'Biologia I', 'Biologia II', 'Biomedicina', 'Reptes Científics',
  ],
  'Tecnològic': [
    'Tecnologia i Enginyeria I', 'Tecnologia i Enginyeria II', 'Dibuix Tècnic I',
    'Dibuix Tècnic II', 'Llenguatges de programació', 'Robòtica',
  ],
  'Artístic': ['Història de l’Art', 'Comunicació Audiovisual'],
  'Activitat física': ['Educació Física'],
};
const domains = new Map(Object.entries(domainSubjects).flatMap(([domain, names]) =>
  names.map(name => [subjectKey(name), domain])));

// A student's contribution to a comparison is usable when there is one
// unambiguous numeric mark for that subject.
function marksBySubject(student, common = false) {
  const marks = new Map();
  for (const grade of student.grades) {
    if (grade.state !== 'number' || !grade.subject || (common && grade.type !== 'comuna')) continue;
    const key = subjectKey(grade.subject);
    marks.set(key, marks.has(key) ? null : grade);
  }
  return marks;
}

function compareSubjects(student, group) {
  const selected = marksBySubject(student);
  const classmates = group.map(peer => marksBySubject(peer));
  return [...selected].flatMap(([key, grade]) => {
    if (!grade) return [];
    const grades = classmates.map(marks => marks.get(key)).filter(Boolean);
    if (grades.length < 2) return [];
    const { average, n } = metrics(grades);
    return [{ name: grade.subject, value: grade.value, average, n, delta: grade.value - average }];
  });
}

function commonPercentile(student, group) {
  const selected = [...marksBySubject(student, true)].filter(([, grade]) => grade);
  if (selected.length < 2) return null;
  const average = metrics(selected.map(([, grade]) => grade)).average;
  let n = 0;
  let lower = 0;
  let ties = 0;
  for (const peer of group) {
    const marks = marksBySubject(peer, true);
    const comparable = selected.map(([key]) => marks.get(key));
    if (comparable.some(grade => !grade)) continue;
    const mean = metrics(comparable).average;
    const delta = mean - average;
    n++;
    if (Math.abs(delta) < 1e-9) ties++;
    else if (delta < 0) lower++;
  }
  return n >= 2 ? { percentile: 100 * (lower + ties / 2) / n, subjects: selected.length, n } : null;
}

export function studentAnalysis(student, group) {
  const notes = metrics(student.grades);
  const [underFour, fourToFive, sufficient, notable, excellent] = subjectDistribution(student.grades);
  const bins = [
    { label: 'Excel·lents · 9–10', count: excellent.count },
    { label: 'Notables · 7–<9', count: notable.count },
    { label: 'Bé o suficients · 5–<7', count: sufficient.count },
    { label: 'Suspeses · <5', count: underFour.count + fourToFive.count },
  ];
  const marks = new Map(Object.keys(domainSubjects).map(domain => [domain, []]));
  for (const grade of student.grades) {
    if (grade.state !== 'number') continue;
    const domain = domains.get(subjectKey(grade.subject));
    if (domain) marks.get(domain).push(grade);
  }
  return {
    notes, bins,
    domains: [...marks].flatMap(([name, grades]) => grades.length ? [{ name, ...metrics(grades) }] : []),
    comparisons: compareSubjects(student, group),
    percentile: commonPercentile(student, group),
  };
}
