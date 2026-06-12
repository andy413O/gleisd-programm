(function () {
  var DEFAULT_DATA_URL = 'https://example.com/data/programm.json';
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
    var items = upcoming(data.items || []);

    if (type === 'open-status') renderOpenStatus(element, data.openStatus);
    if (type === 'today') renderToday(element, data);
    if (type === 'upcoming') renderCards(element, filterBookable(items).slice(0, numberAttr(element, 'data-limit', 3)));
    if (type === 'program-list') renderCards(element, items);
    if (type === 'category') renderCards(element, items.filter(byCategory(element.getAttribute('data-category'))));
    if (type === 'cancelled') renderCards(element, items.filter(function (item) { return item.status === 'faellt aus' || item.status === 'fällt aus'; }));
    if (type === 'opening-hours') renderCards(element, items.filter(isOpeningHour));
  }

  function renderOpenStatus(element, status) {
    if (!status) {
      element.innerHTML = '<div class="gleisd-message">Keine Öffnungszeiten verfügbar.</div>';
      return;
    }
    element.innerHTML = '<div class="gleisd-open-status ' + (status.isOpen ? 'is-open' : 'is-closed') + '">' +
      escapeHtml(status.label || '') +
      '</div>';
  }

  function renderToday(element, data) {
    var today = dateKey(new Date());
    var todaysItems = (data.items || []).filter(function (item) { return item.date === today; });
    var html = '';

    if (data.openStatus && data.openStatus.today) {
      html += '<div class="gleisd-today-hours">' + cardText(data.openStatus.today) + '</div>';
    }

    html += cardsHtml(todaysItems);
    element.innerHTML = html || '<div class="gleisd-message">Heute steht nichts im Programm.</div>';
  }

  function renderCards(element, items) {
    element.innerHTML = cardsHtml(items);
  }

  function cardsHtml(items) {
    if (!items.length) return '<div class="gleisd-message">Keine Termine gefunden.</div>';

    return '<div class="gleisd-grid">' + items.map(function (item) {
      var classes = ['gleisd-card', 'status-' + slug(item.status)];
      var title = escapeHtml(item.title || '');
      if (item.titleExtra) title += ' <span class="gleisd-title-extra">' + escapeHtml(item.titleExtra) + '</span>';

      return '<article class="' + classes.join(' ') + '">' +
        (item.image ? '<img class="gleisd-card-image" src="' + escapeAttr(item.image) + '" alt="">' : '') +
        '<div class="gleisd-card-body">' +
        '<div class="gleisd-meta">' + escapeHtml(formatDate(item.date)) + timeRange(item) + '</div>' +
        '<h3 class="gleisd-title">' + title + '</h3>' +
        (item.status ? '<div class="gleisd-status">' + escapeHtml(item.status) + '</div>' : '') +
        (item.shortDescription ? '<p class="gleisd-description">' + escapeHtml(item.shortDescription) + '</p>' : '') +
        (item.note ? '<p class="gleisd-note">' + escapeHtml(item.note) + '</p>' : '') +
        (item.costs || item.targetGroup || item.location ? '<dl class="gleisd-facts">' + factsHtml(item) + '</dl>' : '') +
        (item.link ? '<a class="gleisd-button" href="' + escapeAttr(item.link) + '">Mehr erfahren</a>' : '') +
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

  function cardText(item) {
    return escapeHtml(formatDate(item.date) + timeRange(item) + (item.note ? ' · ' + item.note : ''));
  }

  function upcoming(items) {
    var today = dateKey(new Date());
    return items.filter(function (item) {
      return item.date >= today;
    }).sort(function (a, b) {
      return (a.date + ' ' + (a.start || '')).localeCompare(b.date + ' ' + (b.start || ''));
    });
  }

  function filterBookable(items) {
    return items.filter(function (item) {
      return item.status !== 'ausblenden' && item.status !== 'geschlossen' && !isOpeningHour(item);
    });
  }

  function byCategory(category) {
    return function (item) {
      return !category || String(item.category || '').toLowerCase() === String(category).toLowerCase();
    };
  }

  function isOpeningHour(item) {
    return item.sourceSheet === 'Öffnungszeiten' || item.sourceSheet === 'Oeffnungszeiten';
  }

  function timeRange(item) {
    if (!item.start && !item.end) return '';
    if (item.start && item.end) return ' · ' + item.start + '-' + item.end + ' Uhr';
    return ' · ' + (item.start || item.end) + ' Uhr';
  }

  function numberAttr(element, name, fallback) {
    var value = Number(element.getAttribute(name));
    return value > 0 ? value : fallback;
  }

  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    var parts = String(value || '').split('-');
    if (parts.length !== 3) return value || '';
    return parts[2] + '.' + parts[1] + '.' + parts[0];
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
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
