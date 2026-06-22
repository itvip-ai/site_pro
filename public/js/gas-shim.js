/*
 * google.script.* compatibility shim.
 *
 * The КП builders were written for Google Apps Script and call the server via
 *   google.script.run.withSuccessHandler(cb).withFailureHandler(err).fnName(args)
 * This shim reimplements that chainable API on top of our REST endpoints
 * (POST /kp/api/<fnName>) so the builder UIs run unchanged on this stack.
 */
(function () {
  function callServer(fnName, args, handlers) {
    // PDF generation was a Google Drive feature — here we just print in-browser.
    if (fnName === 'generatePDFFromHtml') {
      try { window.print(); } catch (e) {}
      if (handlers.ok) handlers.ok({ success: true, url: null, printed: true });
      return;
    }
    fetch('/kp/api/' + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: args || [] }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.__error) {
          if (handlers.err) handlers.err(new Error(data.__error));
        } else if (handlers.ok) {
          handlers.ok(data);
        }
      })
      .catch(function (e) { if (handlers.err) handlers.err(e); });
  }

  function makeRunner(handlers) {
    var target = {
      withSuccessHandler: function (fn) {
        return makeRunner(Object.assign({}, handlers, { ok: fn }));
      },
      withFailureHandler: function (fn) {
        return makeRunner(Object.assign({}, handlers, { err: fn }));
      },
      withUserObject: function () { return makeRunner(handlers); },
    };
    return new Proxy(target, {
      get: function (t, prop) {
        if (prop in t) return t[prop];
        if (typeof prop !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          callServer(prop, args, handlers);
        };
      },
    });
  }

  window.google = window.google || {};
  window.google.script = {
    run: makeRunner({}),
    host: {
      close: function () { window.location.href = '/kp'; },
      editor: { focus: function () {} },
      setHeight: function () {},
      setWidth: function () {},
    },
    url: { getLocation: function (cb) { cb && cb({ parameter: {} }); } },
  };
})();
