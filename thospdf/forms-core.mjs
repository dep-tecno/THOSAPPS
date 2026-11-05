// The viewport transform comes from PDF.js at scale 1, including CropBox and rotation.
export function fieldRectangle(field, viewport) {
  const [a,b,c,d,e,f] = viewport.transform;
  const determinant = a*d-b*c;
  if (!Number.isFinite(determinant) || !determinant) throw new Error('No es pot calcular la posició del camp.');
  const point = (u,v) => {
    const x=u*viewport.width-e, y=v*viewport.height-f;
    return [(d*x-c*y)/determinant,(-b*x+a*y)/determinant];
  };
  const corners=[point(field.x,field.y),point(field.x+field.w,field.y),point(field.x,field.y+field.h),point(field.x+field.w,field.y+field.h)];
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
  return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
export function fitField(field) {
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  return {...field,w:clamp(field.w,.01,1),h:clamp(field.h,.01,1),x:clamp(field.x,0,1-clamp(field.w,.01,1)),y:clamp(field.y,0,1-clamp(field.h,.01,1))};
}
export function validateFields(fields, existingNames = []) {
  if (!fields.length) throw new Error('Afegeix almenys un camp al formulari.');
  const names = new Map(existingNames.map(name=>[name,'existing']));
  const options = new Map();
  for (const field of fields) {
    if (!['text','checkbox','radio','dropdown'].includes(field.type)) throw new Error('Tipus de camp desconegut.');
    const name = (field.type === 'radio' ? field.group : field.name)?.trim();
    if (!name || name.includes('.')) throw new Error('Posa un nom a cada camp i grup, sense punts.');
    if (names.has(name) && !(field.type === 'radio' && names.get(name) === 'radio')) throw new Error(`El nom «${name}» està repetit o ja existeix al PDF.`);
    names.set(name,field.type);
    if (field.type === 'dropdown' && !field.options?.some(option=>option.trim())) throw new Error(`Afegeix opcions al desplegable «${name}».`);
    if (field.type === 'dropdown' && new Set(field.options).size !== field.options.length) throw new Error(`Hi ha opcions repetides a «${name}».`);
    if (field.type === 'radio') {
      if (!field.option?.trim()) throw new Error(`Posa un valor a cada opció del grup «${name}».`);
      if (!options.has(name)) options.set(name,new Set());
      if (options.get(name).has(field.option.trim())) throw new Error(`El valor «${field.option}» està repetit dins de «${name}».`);
      options.get(name).add(field.option.trim());
    }
    if (!Number.isInteger(field.page) || field.page<0 || ![field.x,field.y,field.w,field.h].every(Number.isFinite) || field.w<.01 || field.h<.01 || field.x<0 || field.y<0 || field.x+field.w>1.000001 || field.y+field.h>1.000001) throw new Error(`Revisa la posició i la mida de «${name}».`);
  }
}
export async function exportForm(PDFLib, bytes, fields, viewports) {
  const {PDFDocument,StandardFonts,rgb,degrees} = PDFLib;
  const doc = await PDFDocument.load(bytes.slice());
  const form = doc.getForm();
  if (form.hasXFA()) throw new Error('Aquest PDF té un formulari XFA que no és compatible amb l’editor.');
  validateFields(fields,form.getFields().map(field=>field.getName()));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const groups = new Map(), created = new Set();
  for (const item of fields) {
    const page=doc.getPage(item.page), viewport=viewports[item.page];
    if (!viewport) throw new Error('Falta la geometria d’una de les pàgines.');
    const rect=fieldRectangle(item,viewport), name=(item.type==='radio'?item.group:item.name).trim();
    let field;
    if (item.type==='radio') {if (!groups.has(name)) groups.set(name,form.createRadioGroup(name)); field=groups.get(name);}
    else if (item.type==='checkbox') field=form.createCheckBox(name);
    else if (item.type==='dropdown') {field=form.createDropdown(name); field.addOptions(item.options);}
    else {field=form.createTextField(name); if(item.multiline)field.enableMultiline(); if(item.initial)field.setText(item.initial);}
    if(item.required)field.enableRequired();
    const texts = item.type==='dropdown'?item.options:item.type==='text'?[item.initial||'']:[];
    try {texts.forEach(text=>font.encodeText(text));} catch {throw new Error(`El camp «${name}» conté un símbol no compatible. Utilitza text sense emojis ni alfabets especials.`);}
    const appearance={...rect,font,borderWidth:.7,borderColor:rgb(.25,.35,.4),textColor:rgb(0,0,0),backgroundColor:undefined,rotate:degrees(0)};
    if(item.type==='radio')field.addOptionToPage(item.option.trim(),page,appearance); else field.addToPage(page,appearance);
    // Set the exact annotation rectangle after addToPage's border expansion.
    const widgets=field.acroField.getWidgets(),widget=widgets[widgets.length-1];
    widget.setRectangle(rect); widget.getOrCreateAppearanceCharacteristics().setRotation(((viewport.rotation||0)%360+360)%360);
    if(item.type==='text'||item.type==='dropdown')field.setFontSize(Math.min(12,Math.max(6,item.h*viewport.height*.55)));
    created.add(field);
  }
  // Only update the newly created fields; keep existing form appearances intact.
  for(const field of created)field.defaultUpdateAppearances(font);
  return doc.save({updateFieldAppearances:false});
}
