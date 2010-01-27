function inspect(aObject,aModal) {
  if (aObject && typeof aObject.appendChild=="function") {
    window.openDialog("chrome://inspector/content/", "_blank",
              "chrome,all,dialog=no"+(aModal?",modal":""), aObject);
  } else {
    window.openDialog("chrome://inspector/content/object.xul", "_blank",
              "chrome,all,dialog=no"+(aModal?",modal":""), aObject);
  }
}

function aboutConfig() {
  window.open('about:config', 'about_config', 'chrome,dependent,width=700,height=500');
}

function restart() {
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
      getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit |
                  Components.interfaces.nsIAppStartup.eRestart);
}

function jetpackRun() {
  gFMJetpackPackages.run();
}
