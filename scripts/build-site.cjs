const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, {recursive:true});
for (const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))) {
 let html=fs.readFileSync(path.join(root,name),'utf8');
 html=html.replace(/<div class="preview-label">[\s\S]*?<\/div>/g,'');
 if(name==='bookings.html') html=html.replace('Online booking is not available yet','Request your appointment').replace('Requests cannot be sent from this preview until the local booking system is connected.','Your preferred date and time are subject to confirmation by Maltech.').replace('Preview only — booking requests cannot be submitted yet.','Loading the booking system…');
 fs.writeFileSync(path.join(output,name),html);
}
for(const folder of ['css','js','images']){
 fs.mkdirSync(path.join(output,folder),{recursive:true});
 for(const name of fs.readdirSync(path.join(root,folder)))if(/\.(css|js|jpe?g|png|webp|svg)$/i.test(name))fs.copyFileSync(path.join(root,folder,name),path.join(output,folder,name));
}
console.log('Built website assets in dist/ (source, secrets and app working copies excluded).');
