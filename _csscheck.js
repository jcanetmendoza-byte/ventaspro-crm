const fs=require('fs');
const css=fs.readFileSync('styles.css','utf8');
console.log('Total lines:', css.split('\n').length);
console.log('Has .modal-bg:', css.includes('.modal-bg'));
console.log('Has .modal-bg.open:', css.includes('.modal-bg.open'));
console.log('Has .dp {:', css.includes('.dp {'));
console.log('Has .panel-overlay:', css.includes('.panel-overlay'));
console.log('Has .settings-actions:', css.includes('.settings-actions'));
console.log('Has .btn-primary:', css.includes('.btn-primary'));
console.log('Has .fab:', css.includes('.fab'));
// Find where settings-actions ends
const idx = css.indexOf('.settings-actions');
console.log('.settings-actions at char:', idx);
console.log('Content around it:', JSON.stringify(css.slice(idx, idx+200)));
