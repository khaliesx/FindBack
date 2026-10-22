let offlineReady=false;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function instructions(){
  const modal=document.querySelector('#modal');
  document.querySelector('#modal-content').innerHTML=`<div class="eyebrow">FINDBACK, IN YOUR POCKET</div><h2>${installed()?'You’re in the app.':'Add FindBack to your iPhone'}</h2>
    ${installed()?'<p>FindBack is running from your Home Screen.</p>':'<ol class="install-steps"><li>Open this link in <strong>Safari</strong> on your iPhone.</li><li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. You may need to open Safari’s menu first.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li><li>Launch <strong>FindBack</strong> from its new Home Screen icon.</li></ol>'}
    <div class="notice" id="offline-status">${offlineReady?'✓ Basic demo saved for offline use.':'Open once online and wait for the basic demo to finish saving.'}</div>
    <p>For a smooth recording, use the bottle demo and description search. Optional AI downloads need internet.</p>
    <button class="button dark full" data-close-go="home">Back to FindBack</button>`;
  if(!modal.open)modal.showModal();
  modal.scrollTop=0;document.body.style.overflow='hidden';
}
document.addEventListener('click',event=>{if(event.target.closest('#install-app'))instructions()});
if('serviceWorker' in navigator&&window.isSecureContext){
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
    offlineReady=true;
    const label=document.querySelector('#offline-status');
    if(label)label.textContent='✓ Basic demo saved for offline use.';
  }).catch(()=>{
    const label=document.querySelector('#offline-status');
    if(label)label.textContent='Offline setup could not finish. Reopen online to try again.';
  });
}
