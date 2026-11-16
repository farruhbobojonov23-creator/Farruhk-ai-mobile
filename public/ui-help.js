// Optional explanations; status and validation messages stay outside.
export function helpDetails(content, label = 'Подробнее') {
 const details = document.createElement('details');
 details.className = 'fai-help-details';
 const summary = document.createElement('summary');
 summary.textContent = label;
 details.append(summary);
 if (typeof content === 'string') {
  const p = document.createElement('p'); p.textContent = content; details.append(p);
 } else details.append(content);
 return details;
}
