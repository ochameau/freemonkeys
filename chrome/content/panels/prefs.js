const gFMPrefs = {
  get defaultProfilePath () {
    return gFreemonkeys.prefs.getCharPref("paths.profile");
  },
  set defaultProfilePath (v) {
    gFreemonkeys.prefs.setCharPref("paths.profile",v);
    return v;
  },
  get defaultApplicationPath () {
    return gFreemonkeys.prefs.getCharPref("paths.application");
  },
  set defaultApplicationPath (v) {
    gFreemonkeys.prefs.setCharPref("paths.application",v);
    return v;
  },
  
  settings : {
    get switchToReport () {
      return gFreemonkeys.prefs.getBoolPref("settings.auto-switch-to-report");
    },
    set switchToReport (v) {
      gFreemonkeys.prefs.setBoolPref("settings.auto-switch-to-report",v);
      return v;
    }
  }
};

gFMPrefs.refreshSettings = function () {
  var application = document.getElementById("application-path");
  var profile = document.getElementById("profile-path");
  if (this.defaultApplicationPath)
    application.innerHTML = this.defaultApplicationPath;
  else
    application.innerHTML = "<strong>Need to be set!</strong>";
  if (this.defaultProfilePath)
    profile.innerHTML = this.defaultProfilePath;
  else
    profile.innerHTML = "<strong>Need to be set!</strong>";
  var switchToReport = document.getElementById("auto-switch-to-report");
  if (this.settings.switchToReport)
    switchToReport.setAttribute("checked","true");
  else if (switchToReport.hasAttribute("checked"))
    switchToReport.removeAttribute("checked");
}

gFMPrefs.toggleSwitchToReport = function () {
  gFMPrefs.settings.switchToReport = !gFMPrefs.settings.switchToReport;
  this.refreshSettings();
}

gFMPrefs.selectProfile = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Profile folder", nsIFilePicker.modeGetFolder);
  //fp.appendFilter("Freemonkey Test set Files","*.fmt");
  //fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    this.defaultProfilePath = file.path;
    this.refreshSettings();
  }
}

gFMPrefs.selectApplication = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Application binary", nsIFilePicker.modeOpen);
  fp.appendFilter("Application binary","*.exe");
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    this.defaultApplicationPath = file.path;
    this.refreshSettings();
  }
}