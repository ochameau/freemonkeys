const gFMPrefs = {
  get defaultProfilePath () {
    return gFreemonkeys.prefs.getCharPref("paths.profile");
  },
  set defaultProfilePath (v) {
    if (v && v.length>0)
      gFMPrefs.settings.useEmptyProfile = false;
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
    },
    get copyProfile () {
      return gFreemonkeys.prefs.getBoolPref("settings.profile.copy");
    },
    set copyProfile (v) {
      gFreemonkeys.prefs.setBoolPref("settings.profile.copy",v);
      return v;
    },
    get useEmptyProfile () {
      return gFreemonkeys.prefs.getBoolPref("settings.profile.empty");
    },
    set useEmptyProfile (v) {
      if (v)
        gFMPrefs.defaultProfilePath = "";
      gFreemonkeys.prefs.setBoolPref("settings.profile.empty",v);
      return v;
    },
    
    get defaultPrefs () {
      return gFreemonkeys.prefs.getCharPref("settings.default-preferences");
    },
    set defaultPrefs (v) {
      gFreemonkeys.prefs.setCharPref("settings.default-preferences",v);
      return v;
    },
    
  }
};

gFMPrefs.onload = function () {
  document.getElementById("default-prefs").value = gFMPrefs.settings.defaultPrefs;
}

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
    profile.innerHTML = "<i>Use an empty profile.</i>";
  var switchToReport = document.getElementById("auto-switch-to-report");
  if (this.settings.switchToReport)
    switchToReport.setAttribute("checked","true");
  else if (switchToReport.hasAttribute("checked"))
    switchToReport.removeAttribute("checked");
  var copyProfile = document.getElementById("copy-profile");
  if (this.settings.copyProfile)
    copyProfile.setAttribute("checked","true");
  else if (copyProfile.hasAttribute("checked"))
    copyProfile.removeAttribute("checked");
  var emptyProfile = document.getElementById("empty-profile");
  var profileSelection = document.getElementById("profile-selection");
  if (this.settings.useEmptyProfile) {
    emptyProfile.setAttribute("checked","true");
    profileSelection.className = "disabled";
  } else if (emptyProfile.hasAttribute("checked")) {
    emptyProfile.removeAttribute("checked");
    profileSelection.className = "";
  }
}

gFMPrefs.toggleSwitchToReport = function () {
  gFMPrefs.settings.switchToReport = !gFMPrefs.settings.switchToReport;
  this.refreshSettings();
}

gFMPrefs.toggleCopyProfile = function () {
  gFMPrefs.settings.copyProfile = !gFMPrefs.settings.copyProfile;
  this.refreshSettings();
}

gFMPrefs.toggleEmptyProfile = function () {
  gFMPrefs.settings.useEmptyProfile = !gFMPrefs.settings.useEmptyProfile;
  this.refreshSettings();
}

gFMPrefs.selectProfile = function () {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, "Profile folder", nsIFilePicker.modeGetFolder);
  
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
  fp.appendFilters(nsIFilePicker.filterApps);
  fp.appendFilters(nsIFilePicker.filterAll);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    this.defaultApplicationPath = file.path;
    this.refreshSettings();
  }
}

gFMPrefs.saveDefaultPrefs = function () {
  gFMPrefs.settings.defaultPrefs = document.getElementById("default-prefs").value;
}

window.addEventListener("load",function () {
  window.removeEventListener("load",arguments.callee,false);
  gFMPrefs.onload();
  
}, false);
