(function () {
  var DEFAULT_DATA_URL = 'https://andy413o.github.io/gleisd-programm/data/programm.json';
  var dataPromise = null;

  function loadData(url) {
    if (!dataPromise) {
      dataPromise = fetch(url, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('Programm konnte nicht geladen werden.');
        return response.json();
      });
    }
    return dataPromise;
  }

  function init() {
    var widgets = Array.prototype.slice.call(document.querySelectorAll('[data-gleisd-widget]'));
    if (!widgets.length) return;

    var script = document.currentScript;
    var dataUrl = script && script.getAttribute('data-url') || DEFAULT_DATA_URL;

    loadData(dataUrl)
      .then(function (data) {
        widgets.forEach(function (element) {
          renderWidget(element, data);
        });
      })
      .catch(function () {
        widgets.forEach(function (element) {
          element.innerHTML = '<div class="gleisd-message">Programm kann gerade nicht geladen werden.</div>';
        });
      });
  }

  function renderWidget(element, data) {
    var type = element.getAttribute('data-gleisd-widget');
    var allItems = sortedItems(data.allItems || data.items || []);
    var currentItems = data.currentItems || [];
    var todayItems = data.todayItems || allItems.filter(function (item) {
      return item.date === dateKey(new Date(), data.timezone) && item.statusRelevant !== false;
    });
    var highlights = data.upcomingHighlights || filterBookable(allItems).slice(0, 3);
    var cancelled = data.cancelledItems || allItems.filter(isCancellation);

    if (type === 'open-status') renderOpenStatus(element, data, allItems, todayItems, currentItems);
    if (type === 'today') renderCards(element, todayItems, currentItems);
    if (type === 'upcoming') renderCards(element, highlights.slice(0, numberAttr(element, 'data-limit', 3)), currentItems);
    if (type === 'program-list') renderCards(element, allItems, currentItems);
    if (type === 'category') renderCards(element, allItems.filter(byCategory(element.getAttribute('data-category'))), currentItems);
    if (type === 'cancelled') renderCards(element, cancelled, currentItems);
    if (type === 'opening-hours') renderCards(element, allItems.filter(isOpeningHour), currentItems);
  }

  function renderOpenStatus(element, data, allItems, todayItems, currentItems) {
    if (data.openStatus && !data.allItems) {
      element.innerHTML = '<div class="gleisd-open-status ' + (data.openStatus.isOpen ? 'is-open' : 'is-closed') + '">' +
        escapeHtml(data.openStatus.label || '') +
        '</div>';
      return;
    }

    var currentOpening = currentItems.find(isOpeningHour);
    if (currentOpening) {
      element.innerHTML = '<div class="gleisd-open-status is-open">Jetzt geöffnet' +
        (currentOpening.end ? ' bis ' + escapeHtml(currentOpening.end) + ' Uhr' : '') +
        '</div>';
      return;
    }

    var closure = todayItems.find(function (item) {
      return isOpeningHour(item) && (item.status === 'geschlossen' || item.status === 'fällt aus');
    });
    if (closure) {
      element.innerHTML = '<div class="gleisd-open-status is-closed">Heute geschlossen' +
        (closure.note ? ': ' + escapeHtml(closure.note) : '') +
        '</div>';
      return;
    }

    var nextOpening = allItems.find(function (item) {
      return isOpeningHour(item) && item.status !== 'geschlossen' && item.status !== 'fällt aus';
    });
    if (nextOpening) {
      element.innerHTML = '<div class="gleisd-open-status is-closed">Derzeit geschlossen · nächste Öffnung ' +
        escapeHtml(formatDate(nextOpening.date)) + timeRange(nextOpening) +
        '</div>';
      return;
    }

    element.innerHTML = '<div class="gleisd-message">Keine Öffnungszeiten verfügbar.</div>';
  }

  function renderCards(element, items, currentItems) {
    element.innerHTML = cardsHtml(sortedItems(items), currentItems || []);
  }

  function cardsHtml(items, currentItems) {
    if (!items.length) return '<div class="gleisd-message">Keine Termine gefunden.</div>';

    var currentLookup = {};
    currentItems.forEach(function (item) {
      currentLookup[itemKey(item)] = true;
    });

    return '<div class="gleisd-grid">' + items.map(function (item) {
      var isCurrent = Boolean(currentLookup[itemKey(item)]);
      var classes = ['gleisd-card', 'status-' + slug(item.status)];
      var title = escapeHtml(item.title || '');
      var link = item.url || item.link || '';

      if (isCurrent) classes.push('is-current');
      if (item.titleExtra) title += ' <span class="gleisd-title-extra">' + escapeHtml(item.titleExtra) + '</span>';

      return '<article class="' + classes.join(' ') + '">' +
        (item.image ? '<img class="gleisd-card-image" src="' + escapeAttr(item.image) + '" alt="">' : '') +
        '<div class="gleisd-card-body">' +
        '<div class="gleisd-meta">' + escapeHtml(formatDate(item.date)) + timeRange(item) + '</div>' +
        (isCurrent ? '<div class="gleisd-current">Läuft gerade</div>' : '') +
        '<h3 class="gleisd-title">' + title + '</h3>' +
        (item.status ? '<div class="gleisd-status">' + escapeHtml(item.status) + '</div>' : '') +
        (item.shortDescription ? '<p class="gleisd-description">' + escapeHtml(item.shortDescription) + '</p>' : '') +
        (item.note ? '<p class="gleisd-note">' + escapeHtml(item.note) + '</p>' : '') +
        (item.holidayInfo ? '<p class="gleisd-holiday">' + escapeHtml(item.holidayInfo) + '</p>' : '') +
        (item.costs || item.targetGroup || item.location ? '<dl class="gleisd-facts">' + factsHtml(item) + '</dl>' : '') +
        (link ? '<a class="gleisd-button" href="' + escapeAttr(link) + '">Mehr erfahren</a>' : '') +
        '</div>' +
        '</article>';
    }).join('') + '</div>';
  }

  function factsHtml(item) {
    var html = '';
    if (item.costs) html += '<dt>Kosten</dt><dd>' + escapeHtml(item.costs) + '</dd>';
    if (item.targetGroup) html += '<dt>Zielgruppe</dt><dd>' + escapeHtml(item.targetGroup) + '</dd>';
    if (item.location) html += '<dt>Ort</dt><dd>' + escapeHtml(item.location) + '</dd>';
    return html;
  }

  function sortedItems(items) {
    return items.slice().sort(function (a, b) {
      return (a.date + ' ' + (a.start || '')).localeCompare(b.date + ' ' + (b.start || ''));
    });
  }

  function filterBookable(items) {
    return items.filter(function (item) {
      return item.status !== 'ausblenden' && item.status !== 'geschlossen' && !isOpeningHour(item);
    });
  }

  function isCancellation(item) {
    return item.status === 'fällt aus' || item.status === 'faellt aus' || item.status === 'geändert' || item.status === 'geaendert';
  }

  function byCategory(category) {
    return function (item) {
      return !category || String(item.category || '').toLowerCase() === String(category).toLowerCase();
    };
  }

  function isOpeningHour(item) {
    var category = slug(item.category || '');
    return category === 'oeffnung' || item.sourceSheet === 'Öffnungszeiten' || item.sourceSheet === 'Oeffnungszeiten';
  }

  function itemKey(item) {
    return [item.date, item.start, item.end, item.title, item.sourceSheet, item.sourceRow].join('|');
  }

  function timeRange(item) {
    if (!item.start && !item.end) return '';
    if (item.start && item.end) return ' · ' + escapeHtml(item.start) + '–' + escapeHtml(item.end) + ' Uhr';
    return ' · ' + escapeHtml(item.start || item.end) + ' Uhr';
  }

  function numberAttr(element, name, fallback) {
    var value = Number(element.getAttribute(name));
    return value > 0 ? value : fallback;
  }

  function dateKey(date, timezone) {
    try {
      var parts = new Intl.DateTimeFormat('de-DE', {
        timeZone: timezone || 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      var values = {};
      parts.forEach(function (part) {
        values[part.type] = part.value;
      });
      return values.year + '-' + values.month + '-' + values.day;
    } catch (error) {
      return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }
  }

  function formatDate(value) {
    var parts = String(value || '').split('-');
    if (parts.length !== 3) return value || '';
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
