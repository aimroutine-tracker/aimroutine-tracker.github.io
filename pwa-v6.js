/* PWA registration and install prompt. No analytics or remote API. */
(()=>{'use strict';
 const status=()=>document.querySelector('#install-help');
 const button=()=>document.querySelector('#install-app');
 let pending=null;
 function setNote(value){if(status())status().textContent=value}
 window.addEventListener('beforeinstallprompt',event=>{
   event.preventDefault();pending=event;
   if(button()){button().hidden=false;button().disabled=false}
   setNote('Installer l’application sur cet appareil pour un accès rapide aux routines.');
 });
 window.addEventListener('appinstalled',()=>{
  pending=null;if(button())button().hidden=true;
  setNote('AimRoutine est installé sur cet appareil.');
 });
 if(button())button().addEventListener('click',async()=>{
  if(pending){
    const choice=pending;pending=null;
    try{await choice.prompt();await choice.userChoice;}catch{setNote('Installation non proposée par ce navigateur.')}
    return;
  }
  setNote('Pour installer : utilise « Ajouter à l’écran d’accueil » sur iPhone/iPad, ou le menu Installer dans Chrome/Edge. Une première visite en ligne est nécessaire.');
 });
 if('serviceWorker' in navigator&&window.isSecureContext){
  window.addEventListener('load',()=>{
    const hadController=Boolean(navigator.serviceWorker.controller);
    let refreshed=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController&&!refreshed){
        refreshed=true;
        // Only refresh the page; never clear localStorage/session history.
        window.location.reload();
      }
    });
    navigator.serviceWorker.register('./sw-v6.js',{scope:'./',updateViaCache:'none'})
      .then(reg=>{
        if(status()&&!pending)setNote('Hors ligne : les fichiers essentiels restent accessibles après une première visite.');
        return reg.update();
      }).catch(()=>setNote('Le cache hors ligne n’a pas pu être actualisé.'));
  });
 }
})();
