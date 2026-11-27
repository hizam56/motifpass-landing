/* MotifPass client app — works in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MotifPass = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERIFIED = "2026-11-26";
  var MAX_FILES = 5;
  var MAX_BYTES = 20 * 1024 * 1024;
  var ALLOWED_EXT = ["png", "jpg", "jpeg", "svg", "pdf"];
  var IMAGE_EXT = ["png", "jpg", "jpeg", "svg"];
  var PLANS = { free: "Free", solo: "Solo", multi: "Multi-shop" };

  var KEYS = {
    entitlement: "motifpass.entitlement",
    checklists: "motifpass.checklists",
    passport: "motifpass.passport",
    aiSettings: "motifpass.aiSettings"
  };

  var RATES = {
    etsy: {
      listing: 0.2,
      transaction: 0.065,
      processingPct: 0.03,
      processingFlat: 0.25,
      offsiteUnder10k: 0.15,
      offsiteOver10k: 0.12,
      sourceLabel: "Etsy Fee Basics; Etsy Payments processing fees; How Etsy’s Offsite Ads Work",
      sources: [
        { label: "Etsy fees and taxes", href: "https://help.etsy.com/hc/en-us/articles/115014483627-What-are-the-Fees-and-Taxes-for-Selling-on-Etsy" },
        { label: "Payment processing fees", href: "https://help.etsy.com/hc/en-us/articles/115015628847-What-are-Payment-Processing-Fees-for-Selling-on-Etsy" },
        { label: "Offsite Ads", href: "https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work" }
      ]
    },
    cf: {
      singleShare: 0.5,
      enterpriseShare: 0.3,
      sourceLabel: "Creative Fabrica Designers Terms V1.5, Section 10",
      sources: [
        { label: "Designers Terms V1.5", href: "https://www.creativefabrica.com/designers-terms-conditions-v1-5/" }
      ]
    },
    adobe: {
      royalty: 0.33,
      plans: {
        "3mo": { label: "3 credits/month (monthly)", net: 3.3 },
        "10mo": { label: "10 credits/month (monthly)", net: 1.65 },
        "10yr": { label: "10 credits/month (annual)", net: 0.99 },
        "25mo": { label: "25 credits/month (monthly)", net: 0.92 },
        "25yr": { label: "25 credits/month (annual)", net: 0.66 },
        "40mo": { label: "40 credits/month (monthly)", net: 0.82 },
        "40yr": { label: "40 credits/month (annual)", net: 0.66 },
        "350": { label: "350+ credits/month (minimum guaranteed)", net: null, range: "$0.33–$0.40" },
        "ext_od": { label: "Extended licence (on demand)", net: 26.4 },
        "ext_sub": { label: "Extended licence (subscription)", net: 21.12 }
      },
      sourceLabel: "Adobe Stock contributor royalties (images: 33%)",
      sources: [
        { label: "Adobe Stock contributor royalties", href: "https://contributor.stock.adobe.com/en/royalties" }
      ]
    },
    spoonflower: {
      share: 0.1,
      maxDiscountForCalc: 0.5,
      sourceLabel: "Spoonflower, How Royalties Work (updated Oct 5, 2026)",
      sources: [
        { label: "How Royalties Work", href: "https://support.spoonflower.com/hc/en-us/articles/204444580-How-Royalties-Work" }
      ]
    },
    canva: {
      payoutThreshold: 10,
      sourceLabel: "Canva Contributor Agreement §4.2; Creators Program (per-export dollars unpublished)",
      sources: [
        { label: "Contributor Agreement", href: "https://www.canva.com/policies/contributor-agreement/" },
        { label: "About the Canva Creators Program", href: "https://canvacreatorsupport.zendesk.com/hc/en-us/articles/4415718674191-About-the-Canva-Creators-Program" }
      ]
    },
    verified: VERIFIED
  };

  var CHECKLISTS = {
    adobe: {
      title: "Adobe Stock",
      items: [
        { id: "split", text: "Split the work into individual vectors or illustrations. A customer ZIP is not a stock submission." },
        { id: "keywords", text: "Add titles and keywords to each asset." },
        { id: "specs", text: "Confirm Adobe’s current illustration and vector specs." },
        { id: "ai", text: "Confirm Adobe’s current generative-AI and training-data rules before you submit." }
      ]
    },
    spoonflower: {
      title: "Spoonflower",
      items: [
        { id: "repeat", text: "Create a seamless, high-resolution repeat. A motif pack is not a tiled fabric design." },
        { id: "proof", text: "Proof the tiling before you apply or upload." },
        { id: "noinvent", text: "MotifPass will not invent a seamless repeat from your master file." },
        { id: "original", text: "Only original work counts; colorways of one motif are not separate application designs." }
      ]
    },
    canva: {
      title: "Canva",
      items: [
        { id: "editor", text: "Build a template in the Canva editor. A downloadable SVG or PDF is a different product." },
        { id: "nozip", text: "MotifPass cannot turn a file pack into a Canva template." },
        { id: "optout", text: "Decide the Canva AI-training opt-out in account-level AI settings before any upload." },
        { id: "competitors", text: "Identical templates should not be listed on direct Canva competitors." }
      ]
    }
  };

  function memoryStorage(seed) {
    var data = seed ? Object.assign({}, seed) : {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      _data: data
    };
  }

  function wrapStorage(raw) {
    raw = raw || (typeof localStorage !== "undefined" ? localStorage : memoryStorage());
    return {
      raw: raw,
      get: function (key) {
        try {
          var v = raw.getItem(key);
          return v == null ? null : JSON.parse(v);
        } catch (e) {
          return null;
        }
      },
      set: function (key, val) { raw.setItem(key, JSON.stringify(val)); },
      remove: function (key) { raw.removeItem(key); }
    };
  }

  function planLabel(plan) {
    return PLANS[plan] || plan || "Unknown";
  }

  function isValidSessionId(id) {
    return typeof id === "string" && id.indexOf("cs_test_") === 0 && id.length > "cs_test_".length;
  }

  function isValidPlan(plan) {
    return Object.prototype.hasOwnProperty.call(PLANS, plan);
  }

  function parseQuery(search) {
    var q = String(search || "");
    if (q.charAt(0) === "?") q = q.slice(1);
    var params = {};
    q.split("&").forEach(function (part) {
      if (!part) return;
      var i = part.indexOf("=");
      var k = decodeURIComponent(i >= 0 ? part.slice(0, i) : part).replace(/\+/g, " ");
      var v = decodeURIComponent(i >= 0 ? part.slice(i + 1) : "").replace(/\+/g, " ");
      params[k] = v;
    });
    return params;
  }

  function activateFromSearch(search, now, store) {
    store = wrapStorage(store && store.getItem ? store : (store && store.raw) || store);
    var params = parseQuery(search);
    var plan = (params.plan || "").toLowerCase();
    var sessionId = params.session_id || "";
    var existing = store.get(KEYS.entitlement);

    if (!plan && !sessionId) {
      return { changed: false, entitlement: existing, shouldCleanUrl: false };
    }
    if (!isValidPlan(plan) || !isValidSessionId(sessionId)) {
      return {
        changed: false,
        entitlement: existing,
        shouldCleanUrl: false,
        error: "This app only accepts a Stripe test checkout session (a session id starting with cs_test_) and a plan of free, solo, or multi."
      };
    }
    var ent = {
      plan: plan,
      session_id: sessionId,
      activatedAt: (now || new Date()).toISOString(),
      email: existing && existing.email ? existing.email : null
    };
    store.set(KEYS.entitlement, ent);
    return { changed: true, entitlement: ent, shouldCleanUrl: true };
  }

  function setEntitlementEmail(email, store) {
    store = wrapStorage(store && store.getItem ? store : (store && store.raw) || store);
    var ent = store.get(KEYS.entitlement);
    if (!ent) return null;
    ent.email = String(email || "").trim();
    store.set(KEYS.entitlement, ent);
    return ent;
  }

  function signOut(store) {
    store = wrapStorage(store && store.getItem ? store : (store && store.raw) || store);
    store.remove(KEYS.entitlement);
  }

  function extensionOf(name) {
    var base = String(name || "").split(/[/\\]/).pop() || "";
    var i = base.lastIndexOf(".");
    return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
  }

  function sanitizeFilename(name) {
    var base = String(name || "").split(/[/\\]/).pop() || "";
    var ext = extensionOf(base);
    var stem = ext ? base.slice(0, base.length - ext.length - 1) : base;
    stem = stem.replace(/\s+/g, "_").replace(/[^A-Za-z0-9._-]/g, "").replace(/_+/g, "_").replace(/^\.+/, "");
    if (!stem) stem = "file";
    return ext ? stem + "." + ext : stem;
  }

  function uniqueName(used, name) {
    if (!used[name]) {
      used[name] = 1;
      return name;
    }
    var ext = extensionOf(name);
    var stem = ext ? name.slice(0, name.length - ext.length - 1) : name;
    var n = 2;
    var next;
    do {
      next = ext ? stem + "_" + n + "." + ext : stem + "_" + n;
      n += 1;
    } while (used[next]);
    used[next] = 1;
    return next;
  }

  function validatePackFiles(files) {
    var errors = [];
    var notes = [];
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) errors.push("Add at least one PNG, JPG, SVG or PDF file.");
    if (list.length > MAX_FILES) errors.push("Etsy allows up to " + MAX_FILES + " files in a digital listing. You selected " + list.length + ".");
    var used = {};
    var accepted = [];
    list.forEach(function (f, idx) {
      var name = f.name || "file-" + (idx + 1);
      var ext = extensionOf(name);
      var size = Number(f.size) || 0;
      if (ALLOWED_EXT.indexOf(ext) < 0) {
        errors.push(name + ": only PNG, JPG, SVG and PDF files are accepted.");
        return;
      }
      if (size > MAX_BYTES) {
        errors.push(name + ": each file must be 20 MB or smaller (" + (size / (1024 * 1024)).toFixed(1) + " MB).");
        return;
      }
      var safe = uniqueName(used, sanitizeFilename(name));
      if (safe !== name) notes.push("Renamed “" + name + "” to “" + safe + "” so the filename is Etsy-safe.");
      accepted.push({ originalName: name, name: safe, size: size, ext: ext, file: f });
    });
    return { ok: errors.length === 0 && accepted.length > 0, errors: errors, notes: notes, files: accepted };
  }

  function money(n) {
    if (typeof n !== "number" || !isFinite(n)) return null;
    return Math.round(n * 100) / 100;
  }

  function formatMoney(n) {
    if (n == null || typeof n !== "number" || !isFinite(n)) return "unknown";
    return "$" + n.toFixed(2);
  }

  function calculateEtsy(price, offsite) {
    var p = Number(price);
    if (!(p >= 0) || !isFinite(p)) {
      return { ok: false, error: "Enter a sale price of $0 or more." };
    }
    var transaction = money(p * RATES.etsy.transaction);
    var processing = money(p * RATES.etsy.processingPct + RATES.etsy.processingFlat);
    var listing = RATES.etsy.listing;
    var adsRate = 0;
    var adsLabel = "off";
    if (offsite === "15" || offsite === true || offsite === 0.15) {
      adsRate = RATES.etsy.offsiteUnder10k;
      adsLabel = "15% (under $10k in the prior 365 days)";
    } else if (offsite === "12" || offsite === 0.12) {
      adsRate = RATES.etsy.offsiteOver10k;
      adsLabel = "12% ($10k or more; mandatory)";
    }
    var ads = money(p * adsRate);
    var fees = money(transaction + processing + listing + ads);
    var net = money(p - fees);
    return {
      ok: true,
      marketplace: "Etsy",
      input: "Sale price " + formatMoney(p) + ", Offsite Ads " + adsLabel,
      rate: "$0.20 listing + 6.5% transaction + 3% + $0.25 processing (U.S.)" + (adsRate ? " + Offsite Ads " + Math.round(adsRate * 100) + "%" : ""),
      breakdown: {
        price: p,
        transaction: transaction,
        processing: processing,
        listing: listing,
        ads: ads,
        fees: fees,
        net: net
      },
      net: net,
      netLabel: formatMoney(net),
      unknown: false,
      sources: RATES.etsy.sources,
      verified: VERIFIED
    };
  }

  function calculateCf(price, mode) {
    mode = mode || "single";
    if (mode === "subscription") {
      return {
        ok: true,
        marketplace: "Creative Fabrica",
        input: "Subscription-library download",
        rate: "Share of a collective subscription pool by a points system. Dollars per download are unpublished.",
        net: null,
        netLabel: "unknown",
        unknown: true,
        sources: RATES.cf.sources,
        verified: VERIFIED
      };
    }
    var p = Number(price);
    if (!(p >= 0) || !isFinite(p)) {
      return { ok: false, error: "Enter a single-sale price of $0 or more." };
    }
    var net = money(p * RATES.cf.singleShare);
    return {
      ok: true,
      marketplace: "Creative Fabrica",
      input: "Single sale " + formatMoney(p),
      rate: "50% of the net price paid by the customer (excludes sales tax/VAT). Enterprise licences are 30%.",
      breakdown: { price: p, net: net },
      net: net,
      netLabel: formatMoney(net),
      unknown: false,
      sources: RATES.cf.sources,
      verified: VERIFIED
    };
  }

  function calculateAdobe(planKey) {
    var plan = RATES.adobe.plans[planKey];
    if (!plan) return { ok: false, error: "Choose a buyer plan or licence type." };
    var unknown = plan.net == null;
    return {
      ok: true,
      marketplace: "Adobe Stock",
      input: plan.label,
      rate: "33% royalty on images (photos, vectors, illustrations). Official pay is per download by the buyer’s plan, not a price you set.",
      net: unknown ? null : plan.net,
      netLabel: unknown ? plan.range || "unknown" : formatMoney(plan.net),
      unknown: unknown,
      range: plan.range || null,
      sources: RATES.adobe.sources,
      verified: VERIFIED
    };
  }

  function calculateSpoonflower(pricePaid) {
    var p = Number(pricePaid);
    if (!(p >= 0) || !isFinite(p)) {
      return { ok: false, error: "Enter what the customer pays for the fabric or product." };
    }
    var net = money(p * RATES.spoonflower.share);
    return {
      ok: true,
      marketplace: "Spoonflower",
      input: "Customer pays " + formatMoney(p) + " for the printed item",
      rate: "10% of what the customer pays (discounts counted, but never calculated as if the discount were deeper than 50%). Official example: a $10 item at 10% off pays $0.90.",
      breakdown: { paid: p, net: net },
      net: net,
      netLabel: formatMoney(net),
      unknown: false,
      sources: RATES.spoonflower.sources,
      verified: VERIFIED
    };
  }

  function calculateCanva() {
    return {
      ok: true,
      marketplace: "Canva",
      input: "Royalty pool — per-export rate unpublished",
      rate: "Paid from a pool funded by a percentage of Canva Pro revenue. Dollars per export are unpublished. $10 is the monthly automatic-payout threshold, not a price.",
      net: null,
      netLabel: "unknown",
      unknown: true,
      payoutThreshold: RATES.canva.payoutThreshold,
      sources: RATES.canva.sources,
      verified: VERIFIED
    };
  }

  function etsyReadme(result, now) {
    var lines = [
      "MotifPass Etsy export pack",
      "Built: " + (now || new Date()).toISOString(),
      "",
      "This ZIP is prepared for an Etsy digital-download listing.",
      "Etsy allows up to 5 files of 20 MB each. Filenames were sanitised to letters, numbers, dots, hyphens and underscores.",
      "Titles and tags are still yours to write. Filenames typically cannot be changed after upload.",
      "",
      "Files:"
    ];
    result.files.forEach(function (f) {
      lines.push("- " + f.name + (f.originalName !== f.name ? " (from " + f.originalName + ")" : ""));
    });
    if (result.notes && result.notes.length) {
      lines.push("", "Notes:");
      result.notes.forEach(function (n) { lines.push("- " + n); });
    }
    lines.push("", "MotifPass is a static preview. This pack is not uploaded for you. Not legal or tax advice.");
    return lines.join("\n") + "\n";
  }

  function cfReadme(result, saleType, now) {
    var choice = saleType === "subscription"
      ? "You recorded this listing as part of Creative Fabrica’s subscription library."
      : "You recorded this listing as a Creative Fabrica single sale.";
    var lines = [
      "MotifPass Creative Fabrica export pack",
      "Built: " + (now || new Date()).toISOString(),
      "",
      choice,
      "If this design is also sold at full price on Etsy, a subscription-library listing can undercut it. That conflict only appears in the rights log if you record both flags.",
      "",
      "This pack includes a preview file or a preview note, plus licence.txt (a starter sheet, not legal advice).",
      "",
      "Files:"
    ];
    result.files.forEach(function (f) {
      lines.push("- " + f.name + (f.originalName !== f.name ? " (from " + f.originalName + ")" : ""));
    });
    lines.push("", "MotifPass is a static preview. This pack is not uploaded for you. Not legal or tax advice.");
    return lines.join("\n") + "\n";
  }

  function defaultLicenceText() {
    return [
      "Starter licence sheet (not legal advice)",
      "",
      "This file was generated by MotifPass as a starting point for a Creative Fabrica pack.",
      "It is not a legal licence and is not legal, tax or earnings advice.",
      "Replace this text with the licence terms you actually offer buyers, and re-read Creative Fabrica’s live designer terms before you upload.",
      ""
    ].join("\n");
  }

  function previewPlaceholderNote() {
    return "No PNG, JPG or SVG was included in this pack, so MotifPass could not build preview.png. Add an image file and generate the pack again, or supply your own preview.\n";
  }

  function detectConflict(record) {
    return !!(record && record.etsyFullPrice && record.cfSubscription);
  }

  function conflictMessage(record) {
    var name = record && record.name ? record.name : "This design";
    return name + " is marked as selling at full price on Etsy and also listed in Creative Fabrica’s subscription library.";
  }

  function csvEscape(v) {
    var s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function passportToCsv(records) {
    var header = ["name", "owner", "aiUse", "licence", "exclusivity", "listedOn", "etsyFullPrice", "cfSubscription", "conflict", "updatedAt"];
    var lines = [header.join(",")];
    (records || []).forEach(function (r) {
      lines.push([
        csvEscape(r.name),
        csvEscape(r.owner),
        csvEscape(r.aiUse),
        csvEscape(r.licence),
        csvEscape(r.exclusivity),
        csvEscape((r.listedOn || []).join("; ")),
        r.etsyFullPrice ? "yes" : "no",
        r.cfSubscription ? "yes" : "no",
        detectConflict(r) ? "yes" : "no",
        csvEscape(r.updatedAt)
      ].join(","));
    });
    return lines.join("\n") + "\n";
  }

  function checklistProgress(state, group) {
    var items = CHECKLISTS[group].items;
    var checked = 0;
    items.forEach(function (it) {
      if (state && state[group] && state[group][it.id]) checked += 1;
    });
    return { checked: checked, total: items.length };
  }

  function emptyChecklistState() {
    var s = {};
    Object.keys(CHECKLISTS).forEach(function (g) { s[g] = {}; });
    return s;
  }

  function defaultAiSettings() {
    return {
      canvaOptOut: "undecided",
      adobeRulesAcknowledged: false,
      etsyDisclosureRuleOn: true
    };
  }

  async function buildZipFiles(JSZipCtor, entries) {
    var zip = new JSZipCtor();
    entries.forEach(function (e) {
      zip.file(e.name, e.data);
    });
    return zip;
  }

  async function buildEtsyPack(JSZipCtor, files, now) {
    var result = validatePackFiles(files);
    if (!result.ok) return result;
    var entries = [];
    for (var i = 0; i < result.files.length; i++) {
      var f = result.files[i];
      var data = f.file && f.file.arrayBuffer ? await f.file.arrayBuffer() : f.file && f.file.data ? f.file.data : f.data;
      entries.push({ name: f.name, data: data });
    }
    entries.push({ name: "README.txt", data: etsyReadme(result, now) });
    var zip = await buildZipFiles(JSZipCtor, entries);
    result.entries = entries.map(function (e) { return e.name; });
    result.zip = zip;
    return result;
  }

  async function buildCfPack(JSZipCtor, files, saleType, now) {
    var result = validatePackFiles(files);
    if (!result.ok) return result;
    result.saleType = saleType === "subscription" ? "subscription" : "single";
    var entries = [];
    var firstImage = null;
    for (var i = 0; i < result.files.length; i++) {
      var f = result.files[i];
      var data = f.file && f.file.arrayBuffer ? await f.file.arrayBuffer() : f.file && f.file.data ? f.file.data : f.data;
      entries.push({ name: f.name, data: data });
      if (!firstImage && IMAGE_EXT.indexOf(f.ext) >= 0) firstImage = { name: f.name, data: data, ext: f.ext };
    }
    if (firstImage) {
      var previewName = firstImage.ext === "svg" ? "preview.svg" : "preview.png";
      // Keep the original bytes; if it is a JPEG we still name it preview.jpg rather than invent a PNG conversion.
      if (firstImage.ext === "jpg" || firstImage.ext === "jpeg") previewName = "preview.jpg";
      entries.push({ name: previewName, data: firstImage.data });
      result.previewName = previewName;
    } else {
      entries.push({ name: "PREVIEW.txt", data: previewPlaceholderNote() });
      result.previewName = "PREVIEW.txt";
    }
    entries.push({ name: "licence.txt", data: defaultLicenceText() });
    entries.push({ name: "README.txt", data: cfReadme(result, result.saleType, now) });
    var zip = await buildZipFiles(JSZipCtor, entries);
    result.entries = entries.map(function (e) { return e.name; });
    result.zip = zip;
    return result;
  }

  return {
    VERIFIED: VERIFIED,
    MAX_FILES: MAX_FILES,
    MAX_BYTES: MAX_BYTES,
    KEYS: KEYS,
    RATES: RATES,
    CHECKLISTS: CHECKLISTS,
    PLANS: PLANS,
    memoryStorage: memoryStorage,
    wrapStorage: wrapStorage,
    planLabel: planLabel,
    isValidSessionId: isValidSessionId,
    isValidPlan: isValidPlan,
    parseQuery: parseQuery,
    activateFromSearch: activateFromSearch,
    setEntitlementEmail: setEntitlementEmail,
    signOut: signOut,
    extensionOf: extensionOf,
    sanitizeFilename: sanitizeFilename,
    validatePackFiles: validatePackFiles,
    formatMoney: formatMoney,
    calculateEtsy: calculateEtsy,
    calculateCf: calculateCf,
    calculateAdobe: calculateAdobe,
    calculateSpoonflower: calculateSpoonflower,
    calculateCanva: calculateCanva,
    detectConflict: detectConflict,
    conflictMessage: conflictMessage,
    passportToCsv: passportToCsv,
    checklistProgress: checklistProgress,
    emptyChecklistState: emptyChecklistState,
    defaultAiSettings: defaultAiSettings,
    etsyReadme: etsyReadme,
    cfReadme: cfReadme,
    defaultLicenceText: defaultLicenceText,
    previewPlaceholderNote: previewPlaceholderNote,
    buildEtsyPack: buildEtsyPack,
    buildCfPack: buildCfPack
  };
});
