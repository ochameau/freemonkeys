const EXPORTED_SYMBOLS = ["knownTopWindows"];

const knownTopWindows = [
// Main windows:
  { id    : "firefox-window",
    name  : "Firefox Window",
    params: {
      type: "navigator:browser",
      id  : "main-window"
    }
  },
  { id    : "js-console",
    name  : "JS Console",
    params: {
      type: "global:console",
      id  : "JSConsoleWindow"
    }
  },
  { id    : "dom-inspector",
    name  : "DOM Inspector",
    params: {
      type: "",
      id  : "winInspectorMain"
    }
  },
// Firefox popups
  { id    : "firefox-settings",
    name  : "Firefox Preferences panel",
    params: {
      type: "Browser:Preferences",
      id  : "BrowserPreferences"
    }
  },
  { id    : "firefox-about",
    name  : "About dialog",
    params: {
      type: "Browser:About",
      id  : "aboutDialog"
    }
  },
  { id    : "page-info",
    name  : "Page info dialog",
    params: {
      type: "Browser:page-info",
      id  : "main-window"
    }
  },
  { id    : "download-manager",
    name  : "Download manager",
    params: {
      type: "Download:Manager",
      id  : "downloadManager"
    }
  },
  { id    : "extension-manager",
    name  : "Extension manager",
    params: {
      type: "Extension:Manager",
      id  : "extensionsManager"
    }
  },
  { id    : "places-manager",
    name  : "Places manager",
    params: {
      type: "Places:Organizer",
      id  : "places"
    }
  },

// Firefox sidebars
  { id    : "sidebar-bookmarks",
    name  : "Bookmarks sidebar",
    params: {
      name: "sidebar",
      location: "chrome://browser/content/bookmarks/bookmarksPanel.xul"
    }
  },
  { id    : "sidebar-history",
    name  : "History sidebar",
    params: {
      name: "sidebar",
      location: "chrome://browser/content/history/history-panel.xul"
    }
  }
  
];
