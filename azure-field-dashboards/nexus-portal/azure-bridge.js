// Azure: Nexus Cloud Functions are reached through this site (/nexus/__fn). App Service sign-in reads the
// Authorization header itself, so the Nexus (Firebase) token travels in X-Firebase-Authorization instead.
(function () {
  var prefix = window.location.origin + "/nexus/__fn/", nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input instanceof URL ? input.href : input && input.url;
    if (!url || url.indexOf(prefix) !== 0) return nativeFetch(input, init);
    var headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
    if (headers.has("Authorization")) { headers.set("X-Firebase-Authorization", headers.get("Authorization")); headers.delete("Authorization"); }
    return nativeFetch(input, Object.assign({}, init, { headers: headers, credentials: "same-origin" }));
  };
})();
