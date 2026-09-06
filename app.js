(function () {
  var SHEET_ID = "1ZFcN_iVHn8-I42MKS0Nenul85QynD1nza9qu2rAWC1E";

  var ARABIC_DIGITS = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"
  };

  var roster = [];
  var sheetReady = false;

  var form = document.getElementById("join-form");
  var phoneInput = document.getElementById("phone");
  var submitBtn = document.getElementById("submit-btn");
  var result = document.getElementById("result");
  var groupLink = document.getElementById("group-link");
  var hint = document.getElementById("hint");

  function westernize(value) {
    return String(value || "").replace(/[٠-٩۰-۹]/g, function (digit) {
      return ARABIC_DIGITS[digit] || digit;
    });
  }

  function onlyDigits(value) {
    return westernize(value).replace(/\D/g, "");
  }

  function extractDigitGroups(raw) {
    var text = westernize(raw);
    var matches = text.match(/\d[\d\s\-()+]{6,}/g) || [];
    var groups = [];

    matches.forEach(function (match) {
      var digits = match.replace(/\D/g, "");
      if (digits.length >= 8 && groups.indexOf(digits) === -1) {
        groups.push(digits);
      }
    });

    if (!groups.length) {
      var digits = onlyDigits(text);
      if (digits.length >= 3) {
        groups.push(digits);
      }
    }

    return groups;
  }

  function coreDigits(raw) {
    var digits = onlyDigits(raw);
    if (digits.indexOf("00") === 0) {
      digits = digits.slice(2);
    }

    var prefixes = ["966", "973", "20"];
    for (var i = 0; i < prefixes.length; i += 1) {
      var prefix = prefixes[i];
      if (digits.indexOf(prefix) === 0 && digits.length - prefix.length >= 8) {
        digits = digits.slice(prefix.length);
        break;
      }
    }

    if (digits.charAt(0) === "0") {
      digits = digits.slice(1);
    }

    return digits;
  }

  function lookupKeys(raw) {
    var keys = {};

    function add(key) {
      if (key && key.length >= 3) {
        keys[key] = true;
      }
    }

    var groups = extractDigitGroups(raw);
    if (!groups.length) {
      groups = [onlyDigits(raw)];
    }

    groups.forEach(function (digits) {
      if (digits.indexOf("00") === 0) {
        digits = digits.slice(2);
      }

      add(digits);
      if (digits.charAt(0) === "0") {
        add(digits.slice(1));
      }

      [8, 9, 10].forEach(function (size) {
        if (digits.length >= size) {
          add(digits.slice(-size));
        }
        var stripped = digits.charAt(0) === "0" ? digits.slice(1) : digits;
        if (stripped.length >= size) {
          add(stripped.slice(-size));
        }
      });

      var core = coreDigits(digits);
      add(core);
      add("0" + core);

      if (core.length >= 8) {
        add(core.slice(-8));
        add(core.slice(-9));
        add(core.slice(-10));
      }

      if (core.charAt(0) === "5" && core.length > 9) {
        add(core.slice(0, 9));
        add("0" + core.slice(0, 9));
      }

      if (core.charAt(0) === "1" && core.length > 10) {
        add(core.slice(0, 10));
      }
    });

    return Object.keys(keys);
  }

  function findColumn(labels, testers) {
    for (var i = 0; i < labels.length; i += 1) {
      var label = String(labels[i] || "").toLowerCase();
      for (var t = 0; t < testers.length; t += 1) {
        if (testers[t](label)) {
          return i;
        }
      }
    }
    return -1;
  }

  function parseGviz(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("تعذر قراءة الشيت");
    }
    return JSON.parse(text.slice(start, end + 1));
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i += 1) {
      var char = text.charAt(i);
      if (inQuotes) {
        if (char === '"') {
          if (text.charAt(i + 1) === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(function (item) {
      return item.some(function (value) {
        return String(value || "").trim() !== "";
      });
    });
  }

  function normalizeLink(link) {
    var value = String(link || "").trim();
    if (!value) {
      return "";
    }

    var lower = value.toLowerCase();
    if (lower === "-" || lower === "n/a" || lower === "na" || lower === "none") {
      return "";
    }

    return value;
  }

  function cellValue(row, index) {
    var cells = row.c || [];
    var cell = cells[index];
    if (!cell || cell.v == null || cell.v === "") {
      return "";
    }
    return String(cell.v).trim();
  }

  function buildLookup(table) {
    var labels = (table.cols || []).map(function (col) {
      return col.label || "";
    });

    var phoneIndex = findColumn(labels, [
      function (label) { return label.indexOf("تواصل") !== -1; },
      function (label) { return label.indexOf("phone") !== -1; },
      function (label) { return label.indexOf("رقم") !== -1 && label.indexOf("جريد") === -1; }
    ]);
    var groupIndex = findColumn(labels, [
      function (label) { return label.indexOf("جريد") !== -1; },
      function (label) { return label.indexOf("group") !== -1; }
    ]);
    var linkIndex = findColumn(labels, [
      function (label) { return label.indexOf("whats") !== -1; },
      function (label) { return label.indexOf("واتس") !== -1; }
    ]);

    if (phoneIndex === -1 || linkIndex === -1) {
      throw new Error("الشيت مفيهوش عمود الرقم أو لينك الواتساب");
    }

    var records = [];
    (table.rows || []).forEach(function (row) {
      var phone = cellValue(row, phoneIndex);
      var link = normalizeLink(cellValue(row, linkIndex));
      var group = groupIndex === -1 ? "" : cellValue(row, groupIndex);
      if (!phone) {
        return;
      }

      records.push({
        group: group,
        link: link,
        exact: onlyDigits(phone),
        keys: lookupKeys(phone)
      });
    });

    return records;
  }

  function buildLookupFromCsv(text) {
    var rows = parseCsv(text);
    if (!rows.length) {
      throw new Error("الشيت فاضي");
    }

    return buildLookup({
      cols: rows[0].map(function (label) {
        return { label: label };
      }),
      rows: rows.slice(1).map(function (values) {
        return {
          c: values.map(function (value) {
            return { v: value };
          })
        };
      })
    });
  }

  function findStudent(raw) {
    var typed = onlyDigits(raw);
    var exactMatches = [];

    roster.forEach(function (student, index) {
      if (student.exact === typed) {
        exactMatches.push({ student: student, index: index });
      }
    });

    if (exactMatches.length) {
      return exactMatches[exactMatches.length - 1].student;
    }

    if (typed.length < 8) {
      return null;
    }

    var userKeys = lookupKeys(raw);
    var best = null;
    var bestLen = 0;
    var bestIndex = -1;

    roster.forEach(function (student, index) {
      student.keys.forEach(function (key) {
        if (key.length < 8 || userKeys.indexOf(key) === -1) {
          return;
        }
        if (key.length > bestLen || (key.length === bestLen && index > bestIndex)) {
          best = student;
          bestLen = key.length;
          bestIndex = index;
        }
      });
    });

    return best;
  }

  function showStatus(message, kind) {
    result.className = "result show " + (kind || "err");
    result.textContent = message;
    groupLink.classList.remove("show");
    groupLink.removeAttribute("href");
  }

  function showError(message) {
    showStatus(message, "err");
  }

  function showSuccess(student) {
    var groupName = student.group ? " (" + student.group + ")" : "";
    result.className = "result show ok";
    result.textContent = "تم العثور على جروبك" + groupName + ". اضغط الزر للدخول.";
    groupLink.href = student.link;
    groupLink.classList.add("show");
  }

  function setLoading(isLoading, message) {
    submitBtn.disabled = isLoading;
    phoneInput.disabled = isLoading;
    hint.textContent = message;
  }

  function csvUrl() {
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
      "/export?format=csv&t=" + Date.now();
  }

  function gvizUrl() {
    return "https://docs.google.com/spreadsheets/d/" + SHEET_ID +
      "/gviz/tq?tqx=out:json&headers=1&t=" + Date.now();
  }

  function applyRoster(records) {
    roster = records;
    sheetReady = roster.length > 0;
    if (!sheetReady) {
      throw new Error("مفيش أرقام صالحة في الشيت");
    }
    setLoading(false, "استخدم نفس الرقم المسجّل في الاستمارة، بأي صيغة.");
  }

  function loadSheet() {
    setLoading(true, "جاري تحميل بيانات الطلبة من جوجل شيت...");

    return fetch(csvUrl(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("فشل تحميل الشيت");
        }
        return response.text();
      })
      .then(function (text) {
        applyRoster(buildLookupFromCsv(text));
      })
      .catch(function () {
        return fetch(gvizUrl(), { cache: "no-store" })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("فشل تحميل الشيت");
            }
            return response.text();
          })
          .then(function (text) {
            var payload = parseGviz(text);
            if (!payload.table) {
              throw new Error("صيغة الشيت غير متوقعة");
            }
            applyRoster(buildLookup(payload.table));
          });
      })
      .catch(function () {
        sheetReady = false;
        setLoading(true, "تعذر تحميل جوجل شيت. تأكد إن المشاركة Anyone with the link.");
        showError("تعذر تحميل بيانات الطلبة. حاول تحديث الصفحة.");
      });
  }

  function showLookupResult(phone) {
    var student = findStudent(phone);
    if (!student) {
      showError("هذا الرقم غير مسجل. تأكد من الرقم أو تواصل مع الإدارة.");
      return;
    }

    if (!student.link) {
      showStatus("no group assigned yet", "warn");
      return;
    }

    showSuccess(student);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var phone = phoneInput.value.trim();
    if (!onlyDigits(phone)) {
      showError("من فضلك اكتب رقم التواصل.");
      return;
    }

    loadSheet().then(function () {
      if (!sheetReady) {
        return;
      }
      showLookupResult(phone);
    });
  });

  loadSheet();
})();
