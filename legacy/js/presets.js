/* Preset target sizes, grouped for the Presets tab.
   Add or edit freely — the UI builds itself from this list. */
window.IR = window.IR || {};

window.IR.PRESETS = [
  { group: "Screen", label: "4K UHD",              w: 3840, h: 2160 },
  { group: "Screen", label: "1440p QHD",           w: 2560, h: 1440 },
  { group: "Screen", label: "1080p Full HD",       w: 1920, h: 1080 },
  { group: "Screen", label: "720p HD",             w: 1280, h: 720  },

  { group: "Social", label: "Instagram Square",    w: 1080, h: 1080 },
  { group: "Social", label: "Instagram Portrait",  w: 1080, h: 1350 },
  { group: "Social", label: "Story / Reel",        w: 1080, h: 1920 },
  { group: "Social", label: "YouTube Thumbnail",   w: 1280, h: 720  },
  { group: "Social", label: "X / Twitter Post",    w: 1600, h: 900  },
  { group: "Social", label: "Facebook Cover",      w: 820,  h: 312  },
  { group: "Social", label: "LinkedIn Banner",     w: 1584, h: 396  },

  { group: "Avatar & Icons", label: "Avatar 512",  w: 512,  h: 512  },
  { group: "Avatar & Icons", label: "Avatar 256",  w: 256,  h: 256  },
  { group: "Avatar & Icons", label: "Avatar 128",  w: 128,  h: 128  },
  { group: "Avatar & Icons", label: "Favicon 64",  w: 64,   h: 64   }
];
