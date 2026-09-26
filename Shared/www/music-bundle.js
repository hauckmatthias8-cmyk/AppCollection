(function(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MusicBundleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  function cleanLine(line){
    return String(line || '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .trim();
  }

  function splitTrackLine(line){
    const cleaned = cleanLine(line);
    if (!cleaned) return null;

    for (const sep of ['|', '\t', ';']) {
      const pos = cleaned.indexOf(sep);
      if (pos > 0 && pos < cleaned.length - sep.length) {
        return {
          title: cleaned.slice(0, pos).trim(),
          artist: cleaned.slice(pos + sep.length).trim()
        };
      }
    }

    // Convenience fallback. The documented and safest format remains "Titel | Interpret".
    const dash = cleaned.lastIndexOf(' - ');
    if (dash > 0 && dash < cleaned.length - 3) {
      return {title: cleaned.slice(0, dash).trim(), artist: cleaned.slice(dash + 3).trim()};
    }
    return null;
  }

  function parseTrackList(text, maxTracks){
    const limit = Number.isFinite(maxTracks) ? Math.max(1, maxTracks) : Number.POSITIVE_INFINITY;
    const tracks = [], invalid = [], duplicates = [];
    const seen = new Set();
    const lines = String(text || '').split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const parsed = splitTrackLine(raw);
      if (!parsed || !parsed.title || !parsed.artist) {
        invalid.push({line:i + 1, text:raw.trim()});
        continue;
      }
      const key = `${parsed.title.toLocaleLowerCase('de-DE')}\u0000${parsed.artist.toLocaleLowerCase('de-DE')}`;
      if (seen.has(key)) {
        duplicates.push({line:i + 1, ...parsed});
        continue;
      }
      seen.add(key);
      tracks.push({index:tracks.length, title:parsed.title, artist:parsed.artist});
    }

    return {tracks:Number.isFinite(limit) ? tracks.slice(0, limit) : tracks, invalid, duplicates, truncated:Number.isFinite(limit) && tracks.length > limit};
  }

  function priceOf(offer){
    const n = Number(offer && offer.price);
    return Number.isFinite(n) && n >= 0 ? n : Number.POSITIVE_INFINITY;
  }

  function buildTopBundles(trackEntries, limit, offersPerTrack){
    const maxBundles = Number.isFinite(limit) ? Math.max(1, limit) : 3;
    const perTrack = Number.isFinite(offersPerTrack) ? Math.max(maxBundles, offersPerTrack) : 8;
    if (!Array.isArray(trackEntries) || !trackEntries.length) return [];
    if (trackEntries.some(entry => !Array.isArray(entry.offers) || !entry.offers.length)) return [];

    let bundles = [{items:[], total:0, scoreSum:0}];

    for (const entry of trackEntries) {
      const choices = [...entry.offers]
        .filter(o => Number.isFinite(priceOf(o)))
        .sort((a,b) => priceOf(a) - priceOf(b) || Number(b.score || 0) - Number(a.score || 0))
        .slice(0, perTrack);
      if (!choices.length) return [];

      const candidates = [];
      for (const bundle of bundles) {
        for (const offer of choices) {
          candidates.push({
            items:[...bundle.items, {request:entry.request, offer}],
            total:bundle.total + priceOf(offer),
            scoreSum:bundle.scoreSum + Number(offer.score || 0)
          });
        }
      }

      candidates.sort((a,b) => a.total - b.total || b.scoreSum - a.scoreSum);
      const unique = [];
      const seen = new Set();
      for (const candidate of candidates) {
        const signature = candidate.items.map(x => String(x.offer.id || x.offer.downloadUrl || x.offer.sourcePage || '')).join('\u0001');
        if (seen.has(signature)) continue;
        seen.add(signature);
        unique.push(candidate);
        if (unique.length >= maxBundles) break;
      }
      bundles = unique;
      if (!bundles.length) break;
    }

    return bundles.map((b, i) => ({
      rank:i + 1,
      items:b.items,
      total:Math.round((b.total + Number.EPSILON) * 100) / 100,
      averageScore:b.items.length ? b.scoreSum / b.items.length : 0,
      currency:'EUR'
    }));
  }

  return {cleanLine, splitTrackLine, parseTrackList, buildTopBundles};
});
