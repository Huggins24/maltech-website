const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('nav');
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
    toggle.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); toggle.focus();
  }
});
const form = document.querySelector('#enquiry-form');
if (form) {
  const requested = new URLSearchParams(location.search).get('service');
  const select = form.elements.service;
  if (requested) {
    const matched = [...select.options].find(option => option.text.toLowerCase().includes(requested.toLowerCase().replace(/ inspection$/, '')));
    if (matched) select.value = matched.value;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    document.querySelector('#prepared-message').value = `Maltech vehicle enquiry\n\nName: ${data.get('name')}\nEmail: ${data.get('email')}\nPhone: ${data.get('phone') || 'Not supplied'}\nRegistration: ${data.get('registration')}\nService: ${data.get('service')}\n\n${data.get('message')}`;
    document.querySelector('#enquiry-result').hidden = false;
    document.querySelector('#copy-status').textContent = '';
  });
  document.querySelector('#copy-enquiry').addEventListener('click', async () => {
    const message = document.querySelector('#prepared-message');
    try { await navigator.clipboard.writeText(message.value); document.querySelector('#copy-status').textContent = 'Enquiry copied. Nothing has been sent.'; }
    catch { message.focus(); message.select(); document.querySelector('#copy-status').textContent = 'Select and copy the prepared message above.'; }
  });
}

// Enable submission only when the local integration server is available.
const bookingForm = document.querySelector('#booking-form');
if (bookingForm) {
 const button=bookingForm.querySelector('button[type="submit"]');
 const note=document.querySelector('#booking-note');
 const receipt=document.querySelector('#booking-receipt');
 let connected=false, pending=false, requestKey=null, lastPayload=null, submitted=false;
 for(const name of ['name','email','phone','registration','vehicle','mileage','service','date','time'])bookingForm.elements[name].required=true;
 bookingForm.elements.message.maxLength=5000;
 for(const name of ['name','email','phone','registration','vehicle'])bookingForm.elements[name].maxLength=250;
 const londonToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 bookingForm.elements.date.min=londonToday();
 let availabilityVersion=0;
 bookingForm.elements.date.addEventListener('change', async()=>{
  if(!connected)return;const version=++availabilityVersion;const date=bookingForm.elements.date.value;const time=bookingForm.elements.time;
  time.replaceChildren(new Option('Loading available times…',''));time.disabled=true;
  try{const response=await fetch('/api/public/bookings?date='+encodeURIComponent(date),{cache:'no-store'});const result=await response.json();if(version!==availabilityVersion)return;if(!response.ok)throw Error(result.error||'Could not load times.');time.replaceChildren(new Option(result.times.length?'Select a time':'No drop-off times available',''));for(const value of result.times)time.add(new Option(value,value));note.textContent=result.times.length?'Choose a drop-off time. Maltech will confirm your appointment.':'That day is fully booked. Please choose another date.';}
  catch(error){if(version===availabilityVersion){time.replaceChildren(new Option('Select another date to retry',''));note.textContent=error.message;}}
  finally{if(version===availabilityVersion)time.disabled=false;}
 });
 const requestedService=new URLSearchParams(location.search).get('service');
 if(requestedService){const option=[...bookingForm.elements.service.options].find(o=>o.value===requestedService);if(option)bookingForm.elements.service.value=option.value;}
 fetch('/api/booking-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(config=>{
  if(config?.enabled){connected=true;button.disabled=false;document.querySelector('#booking-connection-title').textContent=config.localPreview?'Connected to the local workshop app':'Booking requests';document.querySelector('#booking-connection-detail').textContent=config.localPreview?'Test bookings are saved to the isolated local app database. No live appointment is made and no email is sent.':'Your request goes directly to Maltech. We’ll review it and contact you to confirm your appointment. Please wait for confirmation before dropping off your vehicle.';note.textContent=config.localPreview?'Local test mode — requests need confirmation in the workshop app.':'Your appointment is only confirmed once you hear from Maltech.';}
 }).catch(()=>{});
 bookingForm.addEventListener('submit',async event=>{
  event.preventDefault();if(!connected||pending||submitted)return;
  const data=new FormData(bookingForm);const date=String(data.get('date'));
  const day=new Date(date+'T12:00:00Z').getUTCDay();
  if([0,6].includes(day)||date<londonToday()){note.textContent='Choose a weekday today or later.';return;}
  const payload={customerName:String(data.get('name')).trim(),email:String(data.get('email')).trim(),mobile:String(data.get('phone')).trim(),vehicleRegistration:String(data.get('registration')).trim(),makeModel:String(data.get('vehicle')).trim(),mileage:Number(data.get('mileage')),service:String(data.get('service')),dropoffDate:date,dropoffTime:String(data.get('time')),additionalInformation:String(data.get('message')).trim(),website:String(data.get('website')||'')};
  const serialized=JSON.stringify(payload);if(serialized!==lastPayload){requestKey=crypto.randomUUID();lastPayload=serialized;}
  pending=true;button.disabled=true;note.textContent='Sending your booking request…';
  try{const response=await fetch('/api/public/bookings',{method:'POST',headers:{'content-type':'application/json','idempotency-key':requestKey},body:serialized,signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Your request could not be saved. Please try again.');if(!result.reference||result.status!=='requested')throw Error('We could not verify your booking request. Please try again.');submitted=true;receipt.hidden=false;document.querySelector('#booking-reference').textContent='Your reference: '+result.reference;note.textContent='Your request has been saved. Please keep your booking reference.';receipt.focus();}
  catch(error){note.textContent=error.name==='TimeoutError'?'The request timed out. Try again with the same details; your request will not be duplicated.':error.message==='Failed to fetch'?'Could not reach the booking system. Please try again.':error.message;}
  finally{pending=false;button.disabled=submitted;}
 });
 document.querySelector('#another-booking').addEventListener('click',()=>{bookingForm.reset();receipt.hidden=true;submitted=false;requestKey=null;lastPayload=null;button.disabled=!connected;note.textContent='Local test mode — requests need confirmation in the workshop app.';bookingForm.elements.name.focus();});
}
