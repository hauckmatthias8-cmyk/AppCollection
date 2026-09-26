(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const titleInput = $('#title-input');
  const artistInput = $('#artist-input');
  const trackListInput = $('#track-list-input');
  const singleModeBtn = $('#single-mode-btn');
  const listModeBtn = $('#list-mode-btn');
  const advancedModeBtn = $('#advanced-mode-btn');
  const singleMode = $('#single-mode');
  const listMode = $('#list-mode');
  const advancedMode = $('#advanced-mode');
  const advancedTitleBtn = $('#advanced-title-btn');
  const advancedArtistBtn = $('#advanced-artist-btn');
  const advancedQueryInput = $('#advanced-query-input');
  const advancedQueryLabel = $('#advanced-query-label');
  const advancedHelp = $('#advanced-help');
  const searchBtn = $('#search-btn');
  const statusBox = $('#status');
  const resultsBox = $('#results');
  const youtubeReferenceBox = $('#youtube-reference');
  const template = $('#result-template');
  const bundleTemplate = $('#bundle-template');
  const BundleCore = window.MusicBundleCore;

  const musicSplash = $('#music-splash');
  let musicSplashTimer = null;
  function musicSplashDone() {
    if (musicSplash && !musicSplash.classList.contains('hide')) musicSplash.classList.add('hide');
    if (musicSplashTimer) clearTimeout(musicSplashTimer);
  }
  if (musicSplash) {
    musicSplash.addEventListener('click', musicSplashDone);
    musicSplash.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') musicSplashDone();
    });
    musicSplashTimer = setTimeout(musicSplashDone, 1450);
  }

  const MAX_HEADER_BYTES = 262144;
  const MAX_RESULTS = 3;
  const MAX_BUNDLES = 3;
  const MAX_CANDIDATES = 24;
  const MAX_OFFERS_PER_BUNDLE_TRACK = 8;
  const MAX_HEADER_CHECKS = 8;
  let searchMode = 'single';
  let advancedKind = 'title-artists';

  function setStatus(text, visible = true) {
    statusBox.textContent = text;
    statusBox.classList.toggle('hidden', !visible);
  }

  function stripHtml(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '');
    return (div.textContent || '').trim();
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(feat|ft|featuring|official|video|audio|lyrics?|remaster(?:ed)?|version)\b/g, ' ')
      .replace(/\.[a-z0-9]{2,5}$/i, ' ')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function levenshtein(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a) return b.length;
    if (!b) return a.length;
    const prev = Array.from({length:b.length + 1}, (_, i) => i);
    const cur = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      return Math.max(.72, ratio);
    }
    const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
    let common = 0;
    for (const t of ta) if (tb.has(t)) common++;
    const union = new Set([...ta, ...tb]).size || 1;
    const token = common / union;
    return Math.max(lev, token * .9);
  }

  function scoreCandidate(c, wantedTitle, wantedArtist) {
    const titleScore = similarity(c.title, wantedTitle);
    const artistScore = c.artist ? similarity(c.artist, wantedArtist) : 0;
    const score = titleScore * .68 + artistScore * .32;
    return Math.max(0, Math.min(1, score));
  }

  function uniqueUsefulQueries(title, artist) {
    const candidates = [
      `${title} ${artist}`.trim(),
      title.trim(),
      artist.trim()
    ];
    const tokenSource = `${title} ${artist}`.split(/\s+/)
      .map(s => normalize(s)).filter(s => s.length >= 4)
      .sort((a,b) => b.length - a.length)
      .slice(0, 3);
    candidates.push(...tokenSource);
    return [...new Set(candidates.filter(Boolean))].slice(0, 6);
  }

  function freeLicense(text) {
    const s = String(text || '').toLowerCase();
    return /creativecommons\.org|creative commons|\bcc0\b|public\s*domain|publicdomain|gnu free documentation|gfdl/.test(s);
  }

  function numericPrice(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function formatPrice(result) {
    if (result.price === 0) return 'Kostenlos';
    if (result.price == null) return 'Preis unbekannt';
    try {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: result.currency || 'EUR'
      }).format(result.price);
    } catch (_) {
      return `${result.price.toFixed(2)} ${result.currency || 'EUR'}`;
    }
  }

  function jsonp(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const callback = `__hauckisItunes_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout'));
      }, timeoutMs);

      window[callback] = data => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP failed'));
      };

      const u = new URL(url);
      u.searchParams.set('callback', callback);
      script.src = u.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function searchItunes(wantedTitle, wantedArtist) {
    const query = `${wantedTitle} ${wantedArtist}`.trim();
    const u = new URL('https://itunes.apple.com/search');
    u.searchParams.set('term', query);
    u.searchParams.set('country', 'DE');
    u.searchParams.set('media', 'music');
    u.searchParams.set('entity', 'song');
    u.searchParams.set('limit', '50');
    u.searchParams.set('explicit', 'Yes');

    let data;
    try {
      data = await jsonp(u.toString());
    } catch (_) {
      return [];
    }

    const results = [];
    for (const item of data?.results || []) {
      if (item.kind !== 'song') continue;
      const price = numericPrice(item.trackPrice);
      if (price == null || !item.trackViewUrl) continue;

      const c = {
        id: `itunes:${item.trackId || item.trackViewUrl}`,
        source: 'Apple / iTunes Store',
        title: item.trackName || '',
        artist: item.artistName || '',
        license: 'Kaufangebot',
        licenseUrl: '',
        downloadUrl: item.trackViewUrl,
        sourcePage: item.trackViewUrl,
        mime: item.kind || 'song',
        fileName: item.trackName || '',
        providerMeta: true,
        paid: price > 0,
        price,
        currency: item.currency || 'EUR',
        album: item.collectionName || ''
      };
      c.score = scoreCandidate(c, wantedTitle, wantedArtist);
      if (c.score >= .40) {
        c.verify = {
          state: 'partial',
          label: 'Katalog-Metadaten',
          detail: `Apple-Katalog: ${c.artist || '?'} – ${c.title || '?'}${c.album ? ` · ${c.album}` : ''}. Dateikopf erst nach Kauf zugänglich.`
        };
        results.push(c);
      }
    }
    return results;
  }

  function formatExt(name, mime) {
    const m = String(name || '').match(/\.([a-z0-9]{2,5})$/i);
    return (m ? m[1].toUpperCase() : (mime || 'Audio')).replace('AUDIO/', '').toUpperCase();
  }


  const YOUTUBE_SEARCH_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
    'https://invidious.tiekoetter.com'
  ];

  function youtubeSearchUrl(title, artist) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist}`.trim())}`;
  }


  function canonicalTrackFromOffers(offers, fallbackTitle, fallbackArtist, youtubeRef=null) {
    // Höchste Priorität: strukturierte YouTube-Musikmetadaten.
    const ytTitle=String(youtubeRef?.musicTrack?.song || '').trim();
    const ytArtist=String(youtubeRef?.musicTrack?.artist || '').trim();
    if(ytTitle && ytArtist){
      return {title:ytTitle,artist:ytArtist,source:'YouTube musicTracks'};
    }

    // Danach den besten tatsächlich gefundenen Provider-Treffer verwenden.
    // Hier zählt die Trefferqualität, nicht der Preis, weil es nur um die
    // kanonische Schreibweise für den Suchlink geht.
    const candidates=arrayify(offers)
      .filter(x=>String(x?.title || '').trim() && String(x?.artist || '').trim())
      .slice()
      .sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));

    if(candidates.length){
      return {
        title:String(candidates[0].title).trim(),
        artist:String(candidates[0].artist).trim(),
        source:String(candidates[0].source || 'Provider')
      };
    }

    // Falls nur YouTube einen professionellen Treffer gefunden hat,
    // dessen bereinigte Metadaten verwenden.
    const ytArtistClean=cleanYouTubeArtistName(String(youtubeRef?.author || '').trim());
    const ytTitleClean=cleanYouTubeTitle(String(youtubeRef?.title || '').trim(),ytArtistClean);
    if(ytTitleClean && ytArtistClean){
      return {title:ytTitleClean,artist:ytArtistClean,source:'YouTube video'};
    }

    // Nur wenn wirklich nichts Verlässlicheres existiert, bleibt die Eingabe.
    return {
      title:String(fallbackTitle || '').trim(),
      artist:String(fallbackArtist || '').trim(),
      source:'Eingabe'
    };
  }

  function applyCanonicalYouTubeSearch(youtubeRef, offers, fallbackTitle, fallbackArtist) {
    const ref=youtubeRef || {
      found:false,title:'',author:'',videoUrl:'',score:0,verifiedByMusicTrack:false
    };
    const canonical=canonicalTrackFromOffers(offers,fallbackTitle,fallbackArtist,ref);
    ref.canonicalTitle=canonical.title;
    ref.canonicalArtist=canonical.artist;
    ref.canonicalSource=canonical.source;

    // Entscheidend: Die URL selbst enthält bereits die korrigierte Schreibweise.
    // Beim Öffnen zeigt deshalb auch die YouTube-Suchleiste genau diese Begriffe.
    ref.searchUrl=youtubeSearchUrl(canonical.title,canonical.artist);
    return ref;
  }

  async function fetchJsonFromPublicInstance(base, path, timeoutMs = 7000) {
    return fetchJson(`${base}${path}`, timeoutMs);
  }

  function scoreYoutubeCandidate(item, wantedTitle, wantedArtist) {
    const title = String(item?.title || '');
    const author = String(item?.author || '');
    const titleScore = similarity(title, wantedTitle);
    const artistScore = Math.max(
      similarity(author, wantedArtist),
      similarity(title, wantedArtist)
    );
    return Math.max(0, Math.min(1, titleScore * .72 + artistScore * .28));
  }

  async function searchYouTubeReference(wantedTitle, wantedArtist) {
    const fallback = {
      found:false,
      searchUrl:youtubeSearchUrl(wantedTitle,wantedArtist),
      title:'',
      author:'',
      videoUrl:'',
      score:0,
      verifiedByMusicTrack:false
    };

    const query = `${wantedTitle} ${wantedArtist} type:video`;
    for (const base of YOUTUBE_SEARCH_INSTANCES) {
      let data;
      try {
        data = await fetchJsonFromPublicInstance(
          base,
          `/api/v1/search?q=${encodeURIComponent(query)}&page=1&region=DE`
        );
      } catch (_) {
        continue;
      }

      const candidates = arrayify(data)
        .filter(x => x && x.type === 'video' && x.videoId)
        .map(x => ({...x, _score:scoreYoutubeCandidate(x,wantedTitle,wantedArtist)}))
        .sort((a,b) => b._score-a._score)
        .slice(0,5);

      if (!candidates.length) continue;

      let best = candidates[0];
      let bestScore = best._score;
      let trackVerification = null;

      // The video endpoint can expose YouTube's musicTracks metadata. Use it
      // for stronger verification when the public instance can provide it.
      for (const candidate of candidates.slice(0,2)) {
        try {
          const details = await fetchJsonFromPublicInstance(
            base,
            `/api/v1/videos/${encodeURIComponent(candidate.videoId)}?region=DE`,
            6500
          );
          for (const track of arrayify(details?.musicTracks)) {
            const trackScore = scoreCandidate(
              {title:String(track?.song || ''),artist:String(track?.artist || '')},
              wantedTitle,
              wantedArtist
            );
            if (trackScore > bestScore) {
              best = candidate;
              bestScore = trackScore;
              trackVerification = {
                song:String(track?.song || ''),
                artist:String(track?.artist || ''),
                album:String(track?.album || '')
              };
            } else if (candidate.videoId === best.videoId && trackScore >= .58) {
              trackVerification = {
                song:String(track?.song || ''),
                artist:String(track?.artist || ''),
                album:String(track?.album || '')
              };
            }
          }
        } catch (_) {}
      }

      if (bestScore < .42) continue;

      const correctedArtist=String(
        trackVerification?.artist ||
        cleanYouTubeArtistName(best.author) ||
        wantedArtist
      ).trim();
      const correctedTitle=String(
        trackVerification?.song ||
        cleanYouTubeTitle(best.title,correctedArtist) ||
        wantedTitle
      ).trim();

      return {
        found:true,
        searchUrl:youtubeSearchUrl(correctedTitle,correctedArtist),
        canonicalTitle:correctedTitle,
        canonicalArtist:correctedArtist,
        canonicalSource:trackVerification?'YouTube musicTracks':'YouTube video',
        title:String(best.title || ''),
        author:String(best.author || ''),
        videoUrl:`https://www.youtube.com/watch?v=${encodeURIComponent(best.videoId)}`,
        score:bestScore,
        verifiedByMusicTrack:!!trackVerification,
        musicTrack:trackVerification,
        via:base
      };
    }
    return fallback;
  }

  function renderYouTubeReference(ref, wantedTitle, wantedArtist) {
    if (!youtubeReferenceBox) return;
    youtubeReferenceBox.innerHTML='';

    const card=document.createElement('article');
    card.className='youtube-card';

    const top=document.createElement('div');
    top.className='youtube-top';
    const left=document.createElement('div');
    const source=document.createElement('div');
    source.className='youtube-source';
    source.textContent='YouTube · Hör-/Prüfreferenz';
    const h=document.createElement('h2');
    const meta=document.createElement('div');
    meta.className='youtube-meta';

    if (ref?.found) {
      h.textContent=ref.title || `${wantedTitle} – ${wantedArtist}`;
      if(ref.musicTrack){
        meta.textContent=`${ref.musicTrack.artist || ref.author || wantedArtist} · ${ref.musicTrack.song || ref.title}${ref.musicTrack.album ? ` · ${ref.musicTrack.album}` : ''}`;
      } else {
        meta.textContent=`Kanal: ${ref.author || 'unbekannt'} · Suchabgleich, kein Download-Angebot`;
      }
    } else {
      h.textContent=`${wantedTitle} – ${wantedArtist}`;
      meta.textContent='Kein ausreichend sicherer Einzelvideotreffer über die öffentlichen Suchendpunkte ermittelt. Die YouTube-Suche kann direkt geöffnet werden.';
    }
    left.append(source,h,meta);
    top.append(left);

    if(ref?.found){
      const score=document.createElement('div');
      score.className='youtube-score';
      score.textContent=`Treffer ${Math.round((ref.score||0)*100)} %`;
      top.append(score);
    }
    card.append(top);

    const actions=document.createElement('div');
    actions.className='youtube-actions';
    if(ref?.found && ref.videoUrl){
      const a=document.createElement('a');
      a.className='youtube-link';
      a.href=ref.videoUrl;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.textContent='Video auf YouTube öffnen';
      actions.append(a);
    }
    const s=document.createElement('a');
    s.className='youtube-search-link';
    s.href=ref?.searchUrl || youtubeSearchUrl(wantedTitle,wantedArtist);
    s.target='_blank';
    s.rel='noopener noreferrer';
    s.textContent='YouTube-Suche öffnen';
    const canonicalSearchTitle=String(ref?.canonicalTitle || wantedTitle || '').trim();
    const canonicalSearchArtist=String(ref?.canonicalArtist || wantedArtist || '').trim();
    if(canonicalSearchTitle || canonicalSearchArtist){
      s.title=`YouTube-Suche: ${[canonicalSearchTitle,canonicalSearchArtist].filter(Boolean).join(' – ')}`;
    }
    actions.append(s);
    card.append(actions);

    youtubeReferenceBox.append(card);
    youtubeReferenceBox.classList.remove('hidden');
  }

  function clearYouTubeReference(){
    if(!youtubeReferenceBox) return;
    youtubeReferenceBox.innerHTML='';
    youtubeReferenceBox.classList.add('hidden');
  }

  async function fetchJson(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch(url, {signal: ctrl.signal, cache: 'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch(url, {signal: ctrl.signal, cache: 'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function arrayify(value) {
    return Array.isArray(value) ? value : (value == null ? [] : [value]);
  }

  function freeToUseArtistNames(track) {
    return arrayify(track?.artists)
      .map(entry => {
        if (Array.isArray(entry)) {
          const obj = entry[1];
          return obj && typeof obj === 'object' ? String(obj.name || '') : String(obj || '');
        }
        return entry && typeof entry === 'object' ? String(entry.name || '') : String(entry || '');
      })
      .filter(Boolean);
  }

  async function searchFreeToUse(wantedTitle, wantedArtist, options={}) {
    const found = new Map();
    const queries = uniqueUsefulQueries(wantedTitle, wantedArtist).slice(0, options.queryLimit ?? 4);

    for (const q of queries) {
      const u = new URL('https://api.freetouse.com/v3/music/tracks/search');
      u.searchParams.set('query', q);
      u.searchParams.set('limit', '30');
      u.searchParams.set('offset', '0');

      let data;
      try { data = await fetchJson(u.toString()); } catch (_) { continue; }

      for (const track of data?.data || []) {
        const artists = freeToUseArtistNames(track);
        const fileUrl = track?.files?.mp3 || '';
        if (!track?.title || !fileUrl) continue;

        const candidate = {
          id: `freetouse:${track.id || fileUrl}`,
          source: 'Free To Use',
          title: String(track.title || ''),
          artist: artists.join(', '),
          license: 'Free To Use License · Bedingungen/Attribution beachten',
          licenseUrl: 'https://freetouse.com/license',
          downloadUrl: fileUrl,
          sourcePage: 'https://freetouse.com/music',
          mime: 'audio/mpeg',
          fileName: (() => {
            try { return decodeURIComponent(new URL(fileUrl).pathname.split('/').pop() || `${track.title}.mp3`); }
            catch (_) { return `${track.title}.mp3`; }
          })(),
          providerMeta: true,
          paid: false,
          price: 0,
          currency: 'EUR',
          duration: Number(track.duration) || null
        };
        candidate.score = scoreCandidate(candidate, wantedTitle, wantedArtist);
        if (candidate.score < .40) continue;

        // This is an official public catalog API. We do not claim a file-header
        // confirmation here because the public MP3 host may use a different CDN.
        candidate.verify = {
          state: 'partial',
          label: 'Offizielle API-Metadaten',
          detail: `Free To Use: ${candidate.artist || '?'} – ${candidate.title}. Kostenloser Download unter der Free To Use License; Nutzungsbedingungen beachten.`
        };

        const old = found.get(candidate.id);
        if (!old || old.score < candidate.score) found.set(candidate.id, candidate);
      }
    }

    return [...found.values()];
  }

  function xmlFirstText(node, localNames) {
    const wanted = new Set(localNames.map(x => x.toLowerCase()));
    for (const el of node.getElementsByTagName('*')) {
      if (wanted.has(String(el.localName || el.nodeName).toLowerCase())) {
        const text = String(el.textContent || '').trim();
        if (text) return text;
      }
    }
    return '';
  }

  function xmlFirstElement(node, localNames) {
    const wanted = new Set(localNames.map(x => x.toLowerCase()));
    for (const el of node.getElementsByTagName('*')) {
      if (wanted.has(String(el.localName || el.nodeName).toLowerCase())) return el;
    }
    return null;
  }

  function ccLicenseLabel(urlOrText) {
    const s = String(urlOrText || '').toLowerCase();
    if (s.includes('/publicdomain/') || /\bpublic\s*domain\b/.test(s)) return 'Public Domain';
    if (s.includes('/by-nc-nd/')) return 'CC BY-NC-ND';
    if (s.includes('/by-nc-sa/')) return 'CC BY-NC-SA';
    if (s.includes('/by-nc/')) return 'CC BY-NC';
    if (s.includes('/by-nd/')) return 'CC BY-ND';
    if (s.includes('/by-sa/')) return 'CC BY-SA';
    if (s.includes('/by/')) return 'CC BY';
    return 'Creative-Commons-Lizenz';
  }

  async function searchCcMixter(wantedTitle, wantedArtist, options={}) {
    const found = new Map();
    const queries = uniqueUsefulQueries(wantedTitle, wantedArtist).slice(0, options.queryLimit ?? 4);

    for (const q of queries) {
      // ccMixter documents its Query/Pool APIs as public remote interfaces.
      // RSS is used here because its enclosure/link fields are standardized.
      const u = new URL('https://ccmixter.org/api/pool/search');
      u.searchParams.set('query', q);
      u.searchParams.set('type', 'any');
      u.searchParams.set('limit', '25');
      u.searchParams.set('format', 'rss');

      let xmlText;
      try { xmlText = await fetchText(u.toString()); } catch (_) { continue; }

      let doc;
      try {
        doc = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (doc.querySelector('parsererror')) continue;
      } catch (_) { continue; }

      for (const item of doc.getElementsByTagName('item')) {
        const title = xmlFirstText(item, ['title']);
        const artist = xmlFirstText(item, ['creator', 'author']);
        const link = xmlFirstText(item, ['link', 'guid']);

        const enclosure = xmlFirstElement(item, ['enclosure']);
        const downloadUrl = enclosure?.getAttribute('url') || '';
        if (!title || !downloadUrl) continue;

        const licenseEl = xmlFirstElement(item, ['license']);
        const licenseUrl =
          licenseEl?.getAttribute('resource') ||
          licenseEl?.getAttribute('rdf:resource') ||
          String(licenseEl?.textContent || '').trim();

        const candidate = {
          id: `ccmixter:${link || downloadUrl}`,
          source: 'ccMixter',
          title,
          artist,
          license: ccLicenseLabel(licenseUrl),
          licenseUrl,
          downloadUrl,
          sourcePage: link || 'https://ccmixter.org/',
          mime: enclosure?.getAttribute('type') || 'audio',
          fileName: (() => {
            try { return decodeURIComponent(new URL(downloadUrl).pathname.split('/').pop() || title); }
            catch (_) { return title; }
          })(),
          providerMeta: true,
          paid: false,
          price: 0,
          currency: 'EUR'
        };
        candidate.score = scoreCandidate(candidate, wantedTitle, wantedArtist);
        if (candidate.score < .40) continue;

        candidate.verify = {
          state: 'partial',
          label: 'ccMixter-Metadaten',
          detail: `${candidate.artist || '?'} – ${candidate.title} · ${candidate.license}.`
        };

        const old = found.get(candidate.id);
        if (!old || old.score < candidate.score) found.set(candidate.id, candidate);
      }
    }

    return [...found.values()];
  }

  async function searchCommons(wantedTitle, wantedArtist, options={}) {
    const queries = uniqueUsefulQueries(wantedTitle, wantedArtist).slice(0, options.queryLimit ?? 6);
    const found = new Map();

    for (const q of queries) {
      const u = new URL('https://commons.wikimedia.org/w/api.php');
      u.searchParams.set('action', 'query');
      u.searchParams.set('generator', 'search');
      u.searchParams.set('gsrsearch', `${q} filetype:audio`);
      u.searchParams.set('gsrnamespace', '6');
      u.searchParams.set('gsrlimit', '15');
      u.searchParams.set('prop', 'imageinfo');
      u.searchParams.set('iiprop', 'url|mime|extmetadata');
      u.searchParams.set('format', 'json');
      u.searchParams.set('origin', '*');

      let data;
      try { data = await fetchJson(u.toString()); } catch (_) { continue; }
      for (const page of Object.values(data?.query?.pages || {})) {
        const ii = page.imageinfo?.[0];
        if (!ii || !String(ii.mime || '').startsWith('audio/')) continue;
        const meta = ii.extmetadata || {};
        const license = stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || '');
        const licenseUrl = stripHtml(meta.LicenseUrl?.value || '');
        if (!freeLicense(`${license} ${licenseUrl}`)) continue;

        const fileTitle = String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, '');
        const title = stripHtml(meta.ObjectName?.value || meta.ImageDescription?.value || fileTitle);
        const artist = stripHtml(meta.Artist?.value || meta.Credit?.value || '');
        const id = ii.url;
        const c = {
          id, source:'Wikimedia Commons', title, artist, license: license || 'Freie Lizenz',
          licenseUrl, downloadUrl: ii.url, sourcePage: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          mime: ii.mime, fileName: String(ii.url).split('/').pop() || fileTitle,
          providerMeta:true,
          paid:false, price:0, currency:'EUR'
        };
        c.score = scoreCandidate(c, wantedTitle, wantedArtist);
        if (c.score >= .34 && (!found.has(id) || found.get(id).score < c.score)) found.set(id, c);
      }
    }
    return [...found.values()];
  }

  function archiveQueryUrl(query) {
    const u = new URL('https://archive.org/advancedsearch.php');
    u.searchParams.set('q', query);
    for (const f of ['identifier','title','creator','licenseurl','rights']) u.searchParams.append('fl[]', f);
    u.searchParams.set('rows', '20');
    u.searchParams.set('page', '1');
    u.searchParams.set('output', 'json');
    return u.toString();
  }

  function luceneEscape(s) {
    return String(s || '').replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1');
  }

  async function searchArchive(wantedTitle, wantedArtist, options={}) {
    const t = luceneEscape(wantedTitle);
    const a = luceneEscape(wantedArtist);
    const queries = [
      `mediatype:audio AND title:"${t}" AND creator:"${a}"`,
      `mediatype:audio AND title:"${t}"`,
      `mediatype:audio AND creator:"${a}"`,
      `mediatype:audio AND (${luceneEscape(wantedTitle)} ${luceneEscape(wantedArtist)})`
    ].slice(0, options.queryLimit ?? 4);

    const docs = new Map();
    for (const query of queries) {
      let data;
      try { data = await fetchJson(archiveQueryUrl(query)); } catch (_) { continue; }
      for (const doc of data?.response?.docs || []) {
        const licenseText = `${doc.licenseurl || ''} ${doc.rights || ''}`;
        if (!freeLicense(licenseText)) continue;
        const creator = Array.isArray(doc.creator) ? doc.creator.join(', ') : (doc.creator || '');
        const itemCandidate = {title: doc.title || '', artist: creator};
        const s = scoreCandidate(itemCandidate, wantedTitle, wantedArtist);
        if (s < .28) continue;
        const old = docs.get(doc.identifier);
        if (!old || old._itemScore < s) docs.set(doc.identifier, {...doc, _itemScore:s, _creator:creator});
      }
    }

    const selected = [...docs.values()].sort((x,y) => y._itemScore - x._itemScore).slice(0, options.archiveItems ?? 8);
    const results = [];
    for (const doc of selected) {
      let meta;
      try { meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`); } catch (_) { continue; }

      const md = meta?.metadata || {};
      const license = md.licenseurl || md.rights || doc.licenseurl || doc.rights || '';
      if (!freeLicense(license)) continue;
      const baseArtist = Array.isArray(md.creator) ? md.creator.join(', ') : (md.creator || doc._creator || '');
      const baseTitle = md.title || doc.title || '';

      const audioFiles = (meta?.files || []).filter(f => {
        const name = String(f.name || '');
        const fmt = String(f.format || '').toLowerCase();
        const extOk = /\.(mp3|flac|ogg|oga|wav|m4a)$/i.test(name);
        const formatOk = /mp3|flac|ogg|vorbis|wav|mpeg4 audio|m4a/.test(fmt);
        return (extOk || formatOk) && !/\.(zip|torrent)$/i.test(name);
      });

      const preferred = audioFiles
        .map(f => {
          const fileTitle = f.title || f.track || String(f.name || '').replace(/\.[a-z0-9]{2,5}$/i, '');
          const fileArtist = f.artist || f.creator || baseArtist;
          const c = {title:fileTitle || baseTitle, artist:fileArtist};
          return {file:f, title:c.title, artist:c.artist, score:scoreCandidate(c,wantedTitle,wantedArtist)};
        })
        .sort((x,y) => (String(y.file.source)==='original')-(String(x.file.source)==='original') || y.score-x.score)
        .slice(0, 3);

      for (const x of preferred) {
        if (x.score < .34) continue;
        const name = String(x.file.name || '');
        results.push({
          id:`ia:${doc.identifier}:${name}`,
          source:'Internet Archive',
          title:x.title || baseTitle,
          artist:x.artist || baseArtist,
          license:stripHtml(license) || 'Freie Lizenz',
          licenseUrl:String(md.licenseurl || doc.licenseurl || ''),
          downloadUrl:`https://archive.org/download/${encodeURIComponent(doc.identifier)}/${name.split('/').map(encodeURIComponent).join('/')}`,
          sourcePage:`https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
          mime:String(x.file.format || ''),
          fileName:name,
          providerMeta:true,
          paid:false, price:0, currency:'EUR',
          score:x.score
        });
      }
    }
    return results;
  }

  async function readPrefix(url, limit = MAX_HEADER_BYTES) {
    const response = await fetch(url, {
      headers: {'Range': `bytes=0-${limit - 1}`},
      cache:'no-store'
    });
    if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
    if (!response.body) {
      const ab = await response.arrayBuffer();
      return new Uint8Array(ab.slice(0, limit));
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (total < limit) {
        const {value, done} = await reader.read();
        if (done) break;
        if (!value) continue;
        const take = Math.min(value.length, limit - total);
        chunks.push(value.subarray(0, take));
        total += take;
        if (total >= limit) break;
      }
    } finally {
      try { await reader.cancel(); } catch (_) {}
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  function textDecoder(name, bytes) {
    try { return new TextDecoder(name).decode(bytes).replace(/\0/g,'').trim(); }
    catch (_) { return new TextDecoder('utf-8').decode(bytes).replace(/\0/g,'').trim(); }
  }

  function synchsafe(b0,b1,b2,b3) {
    return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
  }

  function decodeId3Text(bytes) {
    if (!bytes?.length) return '';
    const enc = bytes[0], data = bytes.subarray(1);
    if (enc === 0) return textDecoder('iso-8859-1', data);
    if (enc === 1) return textDecoder('utf-16', data);
    if (enc === 2) return textDecoder('utf-16be', data);
    return textDecoder('utf-8', data);
  }

  function parseId3(bytes) {
    if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0,3)) !== 'ID3') return null;
    const ver = bytes[3];
    const tagSize = synchsafe(bytes[6],bytes[7],bytes[8],bytes[9]);
    let pos = 10, title='', artist='';
    const end = Math.min(bytes.length, 10 + tagSize);
    while (pos + 10 <= end) {
      const id = String.fromCharCode(...bytes.subarray(pos,pos+4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = ver >= 4
        ? synchsafe(bytes[pos+4],bytes[pos+5],bytes[pos+6],bytes[pos+7])
        : ((bytes[pos+4]<<24)>>>0) + (bytes[pos+5]<<16) + (bytes[pos+6]<<8) + bytes[pos+7];
      if (!size || pos + 10 + size > bytes.length) break;
      const payload = bytes.subarray(pos+10,pos+10+size);
      if (id === 'TIT2') title = decodeId3Text(payload);
      if (id === 'TPE1' || id === 'TPE2') artist = artist || decodeId3Text(payload);
      pos += 10 + size;
      if (title && artist) break;
    }
    return {title,artist,kind:'ID3'};
  }

  function u32le(b, o) {
    return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0;
  }

  function parseVorbisCommentBlock(block) {
    let p=0;
    if (block.length < 8) return {title:'',artist:''};
    const vendorLen=u32le(block,p); p+=4+vendorLen;
    if (p+4>block.length) return {title:'',artist:''};
    const count=u32le(block,p); p+=4;
    let title='',artist='';
    for(let i=0;i<count && p+4<=block.length;i++){
      const len=u32le(block,p); p+=4;
      if(p+len>block.length) break;
      const s=textDecoder('utf-8',block.subarray(p,p+len)); p+=len;
      const eq=s.indexOf('=');
      if(eq<0) continue;
      const k=s.slice(0,eq).toUpperCase(),v=s.slice(eq+1).trim();
      if(k==='TITLE') title=v;
      if(k==='ARTIST' || k==='ALBUMARTIST') artist=artist||v;
    }
    return {title,artist};
  }

  function parseFlac(bytes) {
    if (bytes.length < 8 || textDecoder('ascii',bytes.subarray(0,4)) !== 'fLaC') return null;
    let p=4;
    while(p+4<=bytes.length){
      const h=bytes[p], type=h&0x7f, last=!!(h&0x80);
      const len=(bytes[p+1]<<16)|(bytes[p+2]<<8)|bytes[p+3]; p+=4;
      if(p+len>bytes.length) break;
      if(type===4){
        const c=parseVorbisCommentBlock(bytes.subarray(p,p+len));
        return {...c,kind:'FLAC/Vorbis'};
      }
      p+=len;
      if(last) break;
    }
    return {title:'',artist:'',kind:'FLAC'};
  }

  function parseOgg(bytes) {
    if (bytes.length < 4 || textDecoder('ascii',bytes.subarray(0,4)) !== 'OggS') return null;
    const s=textDecoder('utf-8',bytes);
    const title=(s.match(/TITLE=([^\0\r\n]+)/i)||[])[1]||'';
    const artist=(s.match(/ARTIST=([^\0\r\n]+)/i)||[])[1]||'';
    return {title:title.trim(),artist:artist.trim(),kind:'Ogg/Vorbis'};
  }

  function parseWav(bytes) {
    if(bytes.length<12 || textDecoder('ascii',bytes.subarray(0,4))!=='RIFF' || textDecoder('ascii',bytes.subarray(8,12))!=='WAVE') return null;
    let p=12,title='',artist='';
    while(p+8<=bytes.length){
      const id=textDecoder('ascii',bytes.subarray(p,p+4));
      const len=u32le(bytes,p+4), start=p+8, end=Math.min(bytes.length,start+len);
      if(id==='LIST' && end-start>=4 && textDecoder('ascii',bytes.subarray(start,start+4))==='INFO'){
        let q=start+4;
        while(q+8<=end){
          const sid=textDecoder('ascii',bytes.subarray(q,q+4)), slen=u32le(bytes,q+4);
          const val=textDecoder('utf-8',bytes.subarray(q+8,Math.min(end,q+8+slen))).replace(/\0/g,'').trim();
          if(sid==='INAM') title=val;
          if(sid==='IART') artist=val;
          q += 8+slen+(slen%2);
        }
      }
      p = start+len+(len%2);
    }
    return {title,artist,kind:'WAV/INFO'};
  }

  function parseTags(bytes) {
    return parseId3(bytes) || parseFlac(bytes) || parseOgg(bytes) || parseWav(bytes);
  }

  async function inspectHeader(result, wantedTitle, wantedArtist) {
    try {
      const bytes = await readPrefix(result.downloadUrl);
      const tags = parseTags(bytes);
      if (!tags || (!tags.title && !tags.artist)) {
        return {state:'partial', label:'Quellen-Metadaten', detail:'Datei-Tags nicht vorhanden oder Format im Dateikopf nicht unterstützt.'};
      }
      const ts = tags.title ? similarity(tags.title,wantedTitle) : null;
      const as = tags.artist ? similarity(tags.artist,wantedArtist) : null;
      const values = [ts,as].filter(v => v !== null);
      const avg = values.reduce((a,b)=>a+b,0)/(values.length||1);
      if (avg < .48 || (ts !== null && ts < .36) || (as !== null && as < .30)) {
        return {state:'mismatch', label:'Datei-Tags widersprechen', detail:`${tags.kind}: ${tags.artist || '?'} – ${tags.title || '?'}`, tags};
      }
      return {state:'ok', label:'Datei-Tags bestätigt', detail:`${tags.kind}: ${tags.artist || '?'} – ${tags.title || '?'}`, tags};
    } catch (err) {
      return {state:'partial', label:'Quellen-Metadaten', detail:'Dateikopf konnte vom Browser nicht geprüft werden (CORS/Serverzugriff).'};
    }
  }

  function dedupe(results) {
    const m=new Map();
    for(const r of results){
      const k=`${normalize(r.title)}|${normalize(r.artist)}|${r.fileName || r.downloadUrl}`;
      const old=m.get(k);
      if(!old || old.score<r.score) m.set(k,r);
    }
    return [...m.values()];
  }

  function render(results) {
    resultsBox.innerHTML='';
    for(const r of results){
      const node=template.content.firstElementChild.cloneNode(true);
      node.querySelector('.source-name').textContent=r.source;
      node.querySelector('.result-title').textContent=r.title || r.fileName || 'Unbenannter Titel';
      node.querySelector('.result-artist').textContent=r.artist || 'Interpret nicht angegeben';
      const priceBadge=node.querySelector('.price-badge');
      priceBadge.textContent=formatPrice(r);
      if(r.price>0) priceBadge.classList.add('paid');
      node.querySelector('.match-score').textContent=`Treffer ${Math.round(r.score*100)} %`;
      node.querySelector('.license').textContent=r.price>0
        ? `${r.license || 'Kaufangebot'} · Preis laut Quelle`
        : `Lizenz: ${r.license || 'frei'}`;
      node.querySelector('.file-type').textContent=r.price>0 ? (r.album || 'Musik-Download') : formatExt(r.fileName,r.mime);
      const badge=node.querySelector('.verify-badge');
      badge.textContent=r.verify?.label || 'Quellen-Metadaten';
      badge.classList.add(r.verify?.state === 'ok' ? 'ok' : 'partial');
      node.querySelector('.verify-detail').textContent=r.verify?.detail || 'Titel/Interpret aus der Quelle geprüft.';
      const preview=node.querySelector('.preview-btn');
      if(r.price===0 && r.downloadUrl){
        preview.href=r.downloadUrl;
        preview.textContent='Direkt prüfen';
      }else{
        preview.classList.add('hidden');
      }
      const dl=node.querySelector('.download-btn');
      dl.href=r.price>0 ? (r.sourcePage || r.downloadUrl) : r.downloadUrl;
      dl.textContent=r.price>0 ? 'Zum Angebot' : 'Download';
      if(r.price===0) dl.setAttribute('download','');
      const src=node.querySelector('.source-btn');
      src.href=r.sourcePage;
      src.textContent=r.price>0 ? 'Store öffnen' : 'Quelle';
      resultsBox.appendChild(node);
    }
  }

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  function discoveryKey(value){
    return normalize(value)
      .replace(/\b(?:live|remix|remastered|remaster|radio edit|edit|version|mono|stereo)\b/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function cleanYouTubeArtistName(value){
    return String(value || '')
      .replace(/\s*-\s*Topic\s*$/i,'')
      .replace(/VEVO\s*$/i,'')
      .trim();
  }

  function cleanYouTubeTitle(value, artist){
    let s=String(value || '')
      .replace(/\[[^\]]*(?:official|video|audio|lyrics?|visualizer)[^\]]*\]/ig,' ')
      .replace(/\([^)]*(?:official|video|audio|lyrics?|visualizer)[^)]*\)/ig,' ')
      .replace(/\b(?:official\s+)?(?:music\s+)?video\b/ig,' ')
      .replace(/\bofficial\s+audio\b/ig,' ')
      .replace(/\blyrics?\b/ig,' ')
      .replace(/\s+/g,' ')
      .trim();
    const a=String(artist || '').trim();
    if(a){
      const escaped=a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      s=s.replace(new RegExp(`^${escaped}\\s*[-–—:]\\s*`,'i'),'')
         .replace(new RegExp(`\\s*[-–—:]\\s*${escaped}$`,'i'),'')
         .trim();
    }
    return s;
  }

  function addDiscovery(map, value, score, source, options={}){
    value=String(value || '').trim();
    if(!value) return;
    const key=discoveryKey(value);
    if(!key || key.length<2) return;

    let item=map.get(key);
    if(!item){
      item={
        value,
        score:Number(score)||0,
        sources:new Set(),
        examples:[],
        youtubeUrls:new Set(),
        sourceUrls:new Set()
      };
      map.set(key,item);
    }
    item.score=Math.max(item.score,Number(score)||0);
    if(source) item.sources.add(source);
    if(options.example && !item.examples.includes(options.example)) item.examples.push(options.example);
    if(options.youtubeUrl) item.youtubeUrls.add(options.youtubeUrl);
    if(options.sourceUrl) item.sourceUrls.add(options.sourceUrl);
  }

  function finaliseDiscovery(map){
    return [...map.values()]
      .map(x=>({
        ...x,
        sources:[...x.sources],
        youtubeUrls:[...x.youtubeUrls],
        sourceUrls:[...x.sourceUrls],
        examples:x.examples.slice(0,3)
      }))
      .sort((a,b)=>
        b.sources.length-a.sources.length ||
        b.score-a.score ||
        a.value.localeCompare(b.value,'de',{sensitivity:'base'})
      );
  }

  async function discoverItunes(kind, query){
    const u=new URL('https://itunes.apple.com/search');
    u.searchParams.set('term',query);
    u.searchParams.set('country','DE');
    u.searchParams.set('media','music');
    u.searchParams.set('entity','song');
    u.searchParams.set('limit','200');
    u.searchParams.set('explicit','Yes');

    let data;
    try{ data=await jsonp(u.toString(),15000); }catch(_){ return []; }
    const out=[];
    for(const item of data?.results || []){
      if(item.kind!=='song') continue;
      const title=String(item.trackName || '').trim();
      const artist=String(item.artistName || '').trim();
      if(!title || !artist) continue;

      if(kind==='title-artists'){
        const score=similarity(title,query);
        if(score<.68) continue;
        out.push({value:artist,score,source:'Apple / iTunes',example:title,sourceUrl:item.trackViewUrl || ''});
      }else{
        const score=similarity(artist,query);
        if(score<.70) continue;
        out.push({value:title,score,source:'Apple / iTunes',example:artist,sourceUrl:item.trackViewUrl || ''});
      }
    }
    return out;
  }

  async function discoverFreeToUse(kind, query){
    const u=new URL('https://api.freetouse.com/v3/music/tracks/search');
    u.searchParams.set('query',query);
    u.searchParams.set('limit','100');
    u.searchParams.set('offset','0');
    let data;
    try{ data=await fetchJson(u.toString(),15000); }catch(_){ return []; }

    const out=[];
    for(const track of data?.data || []){
      const title=String(track?.title || '').trim();
      const artists=freeToUseArtistNames(track);
      if(!title || !artists.length) continue;

      if(kind==='title-artists'){
        const score=similarity(title,query);
        if(score<.68) continue;
        for(const artist of artists) out.push({value:artist,score,source:'Free To Use',example:title,sourceUrl:'https://freetouse.com/music'});
      }else{
        const scores=artists.map(a=>similarity(a,query));
        const score=Math.max(...scores,0);
        if(score<.68) continue;
        out.push({value:title,score,source:'Free To Use',example:artists.join(', '),sourceUrl:'https://freetouse.com/music'});
      }
    }
    return out;
  }

  async function discoverCcMixter(kind, query){
    const u=new URL('https://ccmixter.org/api/pool/search');
    u.searchParams.set('query',query);
    u.searchParams.set('type','any');
    u.searchParams.set('limit','100');
    u.searchParams.set('format','rss');

    let xmlText;
    try{ xmlText=await fetchText(u.toString(),15000); }catch(_){ return []; }
    let doc;
    try{
      doc=new DOMParser().parseFromString(xmlText,'application/xml');
      if(doc.querySelector('parsererror')) return [];
    }catch(_){ return []; }

    const out=[];
    for(const item of doc.getElementsByTagName('item')){
      const title=xmlFirstText(item,['title']);
      const artist=xmlFirstText(item,['creator','author']);
      const link=xmlFirstText(item,['link','guid']);
      if(!title || !artist) continue;
      if(kind==='title-artists'){
        const score=similarity(title,query);
        if(score>=.68) out.push({value:artist,score,source:'ccMixter',example:title,sourceUrl:link});
      }else{
        const score=similarity(artist,query);
        if(score>=.68) out.push({value:title,score,source:'ccMixter',example:artist,sourceUrl:link});
      }
    }
    return out;
  }

  async function discoverCommons(kind, query){
    const u=new URL('https://commons.wikimedia.org/w/api.php');
    u.searchParams.set('action','query');
    u.searchParams.set('generator','search');
    u.searchParams.set('gsrsearch',`${query} filetype:audio`);
    u.searchParams.set('gsrnamespace','6');
    u.searchParams.set('gsrlimit','50');
    u.searchParams.set('prop','imageinfo');
    u.searchParams.set('iiprop','url|mime|extmetadata');
    u.searchParams.set('format','json');
    u.searchParams.set('origin','*');

    let data;
    try{ data=await fetchJson(u.toString(),15000); }catch(_){ return []; }
    const out=[];
    for(const page of Object.values(data?.query?.pages || {})){
      const ii=page.imageinfo?.[0];
      if(!ii || !String(ii.mime || '').startsWith('audio/')) continue;
      const meta=ii.extmetadata || {};
      const fileTitle=String(page.title || '').replace(/^File:/i,'').replace(/\.[a-z0-9]{2,5}$/i,'');
      const title=stripHtml(meta.ObjectName?.value || meta.ImageDescription?.value || fileTitle);
      const artist=stripHtml(meta.Artist?.value || meta.Credit?.value || '');
      if(!title || !artist) continue;
      if(kind==='title-artists'){
        const score=similarity(title,query);
        if(score>=.64) out.push({value:artist,score,source:'Wikimedia Commons',example:title,sourceUrl:ii.descriptionurl || ii.url});
      }else{
        const score=similarity(artist,query);
        if(score>=.66) out.push({value:title,score,source:'Wikimedia Commons',example:artist,sourceUrl:ii.descriptionurl || ii.url});
      }
    }
    return out;
  }

  async function discoverArchive(kind, query){
    const u=new URL('https://archive.org/advancedsearch.php');
    const esc=luceneEscape(query);
    u.searchParams.set('q',kind==='title-artists'
      ? `mediatype:audio AND title:("${esc}")`
      : `mediatype:audio AND creator:("${esc}")`);
    for(const f of ['identifier','title','creator']) u.searchParams.append('fl[]',f);
    u.searchParams.set('rows','100');
    u.searchParams.set('page','1');
    u.searchParams.set('output','json');

    let data;
    try{ data=await fetchJson(u.toString(),15000); }catch(_){ return []; }
    const out=[];
    for(const doc of data?.response?.docs || []){
      const title=Array.isArray(doc.title)?doc.title[0]:String(doc.title || '');
      const artists=arrayify(doc.creator).flatMap(x=>String(x || '').split(/\s*;\s*/)).filter(Boolean);
      if(!title || !artists.length) continue;
      if(kind==='title-artists'){
        const score=similarity(title,query);
        if(score<.62) continue;
        for(const artist of artists){
          out.push({value:artist,score,source:'Internet Archive',example:title,sourceUrl:`https://archive.org/details/${encodeURIComponent(doc.identifier)}`});
        }
      }else{
        const score=Math.max(...artists.map(a=>similarity(a,query)),0);
        if(score<.64) continue;
        out.push({value:title,score,source:'Internet Archive',example:artists.join(', '),sourceUrl:`https://archive.org/details/${encodeURIComponent(doc.identifier)}`});
      }
    }
    return out;
  }

  function professionalYouTubeChannel(video){
    const author=String(video?.author || '');
    return video?.authorVerified===true || /\s-\sTopic$/i.test(author) || /VEVO$/i.test(author);
  }

  async function discoverYouTube(kind, query){
    for(const base of YOUTUBE_SEARCH_INSTANCES){
      const collected=[];
      try{
        for(const page of [1,2]){
          const data=await fetchJsonFromPublicInstance(
            base,
            `/api/v1/search?q=${encodeURIComponent(`${query} music type:video sort:views`)}&page=${page}&region=DE`,
            7500
          );
          collected.push(...arrayify(data).filter(x=>x?.type==='video' && x.videoId && professionalYouTubeChannel(x)));
          if(collected.length>=30) break;
        }
      }catch(_){
        continue;
      }

      if(!collected.length) continue;
      const out=[];
      for(const video of collected.slice(0,30)){
        let details=null;
        try{
          details=await fetchJsonFromPublicInstance(base,`/api/v1/videos/${encodeURIComponent(video.videoId)}?region=DE`,6500);
        }catch(_){}

        const tracks=arrayify(details?.musicTracks);
        const videoUrl=`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;

        if(tracks.length){
          for(const track of tracks){
            const song=String(track?.song || '').trim();
            const artist=String(track?.artist || '').trim();
            if(!song || !artist) continue;
            if(kind==='title-artists'){
              const score=similarity(song,query);
              if(score>=.70) out.push({value:artist,score,source:'YouTube (professionell)',example:song,youtubeUrl:videoUrl,sourceUrl:videoUrl});
            }else{
              const score=similarity(artist,query);
              if(score>=.70) out.push({value:song,score,source:'YouTube (professionell)',example:artist,youtubeUrl:videoUrl,sourceUrl:videoUrl});
            }
          }
          continue;
        }

        // Strict fallback: only verified/Topic/VEVO channels are allowed.
        const cleanArtist=cleanYouTubeArtistName(video.author);
        const cleanTitle=cleanYouTubeTitle(video.title,cleanArtist);
        if(kind==='title-artists'){
          const score=similarity(cleanTitle,query);
          if(score>=.74 && cleanArtist) out.push({value:cleanArtist,score,source:'YouTube (verifiziert)',example:cleanTitle,youtubeUrl:videoUrl,sourceUrl:videoUrl});
        }else{
          const score=similarity(cleanArtist,query);
          if(score>=.74 && cleanTitle) out.push({value:cleanTitle,score,source:'YouTube (verifiziert)',example:cleanArtist,youtubeUrl:videoUrl,sourceUrl:videoUrl});
        }
      }
      return out;
    }
    return [];
  }

  async function runAdvancedDiscovery(kind,query){
    const settled=await Promise.allSettled([
      discoverItunes(kind,query),
      discoverFreeToUse(kind,query),
      discoverCcMixter(kind,query),
      discoverCommons(kind,query),
      discoverArchive(kind,query),
      discoverYouTube(kind,query)
    ]);

    const names=['Apple / iTunes','Free To Use','ccMixter','Wikimedia Commons','Internet Archive','YouTube'];
    const failed=[];
    const map=new Map();
    settled.forEach((result,index)=>{
      if(result.status==='rejected'){
        failed.push(names[index]);
        return;
      }
      for(const item of result.value || []){
        addDiscovery(map,item.value,item.score,item.source,item);
      }
    });
    return {items:finaliseDiscovery(map),failed};
  }

  function renderDiscovery(items,kind,query,failed=[]){
    resultsBox.innerHTML='';
    clearYouTubeReference();

    const summary=document.createElement('div');
    summary.className='discovery-summary';
    const noun=kind==='title-artists'?'unterschiedliche Interpreten':'unterschiedliche Titel';
    summary.textContent=`${items.length} ${noun} gefunden. Ergebnisse werden aus allen erreichbaren eingebundenen Quellen zusammengeführt.`;
    resultsBox.append(summary);

    const list=document.createElement('div');
    list.className='discovery-list';

    for(const item of items){
      const card=document.createElement('article');
      card.className='discovery-card';

      const head=document.createElement('div');
      head.className='discovery-head';
      const value=document.createElement('div');
      value.className='discovery-value';
      value.textContent=item.value;
      const score=document.createElement('div');
      score.className='discovery-score';
      score.textContent=`Abgleich ${Math.round((item.score||0)*100)} %`;
      head.append(value,score);

      const sources=document.createElement('div');
      sources.className='discovery-sources';
      sources.textContent=`Quellen: ${item.sources.join(', ')}`;

      const example=document.createElement('div');
      example.className='discovery-example';
      if(kind==='title-artists'){
        example.textContent=`Gefundener Titel: ${item.examples[0] || query}`;
      }else{
        example.textContent=`Gefundener Interpret: ${item.examples[0] || query}`;
      }

      const actions=document.createElement('div');
      actions.className='discovery-actions';

      const use=document.createElement('button');
      use.type='button';
      use.className='discovery-action primary-action';
      use.textContent='Als Einzelsuche übernehmen';
      use.addEventListener('click',()=>{
        setSearchMode('single');
        if(kind==='title-artists'){
          titleInput.value=query;
          artistInput.value=item.value;
        }else{
          titleInput.value=item.value;
          artistInput.value=query;
        }
        window.scrollTo({top:0,behavior:'smooth'});
      });
      actions.append(use);

      if(item.youtubeUrls.length){
        const yt=document.createElement('a');
        yt.className='discovery-action youtube-action';
        yt.href=item.youtubeUrls[0];
        yt.target='_blank';
        yt.rel='noopener noreferrer';
        yt.textContent='YouTube prüfen';
        actions.append(yt);
      }

      if(item.sourceUrls.length){
        const sourceLink=document.createElement('a');
        sourceLink.className='discovery-action';
        sourceLink.href=item.sourceUrls[0];
        sourceLink.target='_blank';
        sourceLink.rel='noopener noreferrer';
        sourceLink.textContent='Quelle öffnen';
        actions.append(sourceLink);
      }

      card.append(head,sources,example,actions);
      list.append(card);
    }
    resultsBox.append(list);

    if(failed.length){
      const warning=document.createElement('div');
      warning.className='bundle-warning';
      warning.textContent=`Zeitweise nicht erreichbare Quellen: ${[...new Set(failed)].join(', ')}. Die angezeigte Liste kann deshalb unvollständig sein.`;
      resultsBox.append(warning);
    }
  }

  function setAdvancedKind(kind){
    advancedKind=kind==='artist-titles'?'artist-titles':'title-artists';
    const byArtist=advancedKind==='artist-titles';
    advancedTitleBtn.classList.toggle('active',!byArtist);
    advancedArtistBtn.classList.toggle('active',byArtist);
    advancedTitleBtn.setAttribute('aria-pressed',String(!byArtist));
    advancedArtistBtn.setAttribute('aria-pressed',String(byArtist));
    advancedQueryLabel.textContent=byArtist?'Interpret':'Titel';
    advancedQueryInput.placeholder=byArtist?'z. B. Metallica':'z. B. Hallelujah';
    advancedHelp.textContent=byArtist
      ? 'Findet alle unterschiedlichen Titel, die diesem Interpreten in den eingebundenen Quellen zugeordnet werden. YouTube wird nur über professionelle/verifizierte Musiktreffer berücksichtigt.'
      : 'Findet alle unterschiedlichen Interpreten, die zu diesem Titel in den eingebundenen Quellen gefunden werden. YouTube-Beiträge werden nur aus professionellen/verifizierten Musikquellen übernommen; typische Laienvideos werden herausgefiltert.';
    if(searchMode==='advanced') searchBtn.textContent=byArtist?'Alle Titel finden':'Alle Interpreten finden';
  }

  function setSearchMode(mode){
    searchMode = ['single','list','advanced'].includes(mode) ? mode : 'single';
    const single=searchMode==='single';
    const list=searchMode==='list';
    const advanced=searchMode==='advanced';

    singleMode.classList.toggle('hidden',!single);
    listMode.classList.toggle('hidden',!list);
    advancedMode.classList.toggle('hidden',!advanced);

    singleModeBtn.classList.toggle('active',single);
    listModeBtn.classList.toggle('active',list);
    advancedModeBtn.classList.toggle('active',advanced);
    singleModeBtn.setAttribute('aria-pressed',String(single));
    listModeBtn.setAttribute('aria-pressed',String(list));
    advancedModeBtn.setAttribute('aria-pressed',String(advanced));

    if(list) searchBtn.textContent='3 günstigste Bundles suchen';
    else if(advanced) searchBtn.textContent=advancedKind==='artist-titles'?'Alle Titel finden':'Alle Interpreten finden';
    else searchBtn.textContent='3 günstigste Treffer suchen';

    resultsBox.innerHTML='';
    clearYouTubeReference();
    setStatus('',false);
  }

  function sortOffers(all){
    return all.sort((a,b)=>{
      const pa=a.price==null?Number.POSITIVE_INFINITY:a.price;
      const pb=b.price==null?Number.POSITIVE_INFINITY:b.price;
      return pa-pb || b.score-a.score;
    });
  }

  async function collectOffers(wantedTitle, wantedArtist, options={}){
    const compact = !!options.compact;
    const providerOptions = compact ? {queryLimit:1, archiveItems:3} : {};
    const settled = await Promise.allSettled([
      searchCommons(wantedTitle,wantedArtist,providerOptions),
      searchArchive(wantedTitle,wantedArtist,providerOptions),
      searchCcMixter(wantedTitle,wantedArtist,providerOptions),
      searchFreeToUse(wantedTitle,wantedArtist,providerOptions),
      searchItunes(wantedTitle,wantedArtist)
    ]);

    let all=[];
    const failed=[];
    settled.forEach((r,i)=>{
      if(r.status==='fulfilled') all.push(...r.value);
      else {
        const names=['Wikimedia Commons','Internet Archive','ccMixter','Free To Use','Apple / iTunes Store'];
        failed.push(names[i] || `Quelle ${i+1}`);
      }
    });

    all=dedupe(all)
      .map(r=>({...r,score:scoreCandidate(r,wantedTitle,wantedArtist)}))
      .filter(r=>r.score>=.40)
      .sort((a,b)=>b.score-a.score)
      .slice(0,MAX_CANDIDATES);

    // In list mode we start with one compact request per source. If that produces
    // nothing, retry the same title once with the broader typo-tolerant provider search.
    if(!all.length && compact && options.relaxedFallback!==false){
      return collectOffers(wantedTitle,wantedArtist,{compact:false,relaxedFallback:false,headerChecks:options.headerChecks});
    }

    const freeCandidates=all.filter(r=>r.price===0 && !r.verify && (r.source==='Wikimedia Commons' || r.source==='Internet Archive'));
    const headerLimit=Math.min(options.headerChecks ?? MAX_HEADER_CHECKS,freeCandidates.length);
    for(let i=0;i<headerLimit;i++){
      freeCandidates[i].verify=await inspectHeader(freeCandidates[i],wantedTitle,wantedArtist);
    }
    for(let i=headerLimit;i<freeCandidates.length;i++){
      freeCandidates[i].verify={state:'partial',label:'Quellen-Metadaten',detail:'Dateikopf aus Datenspargründen nicht automatisch geladen.'};
    }

    all=all.filter(r=>r.verify?.state!=='mismatch');
    sortOffers(all);
    return {offers:all,failed};
  }

  function makeBundleLinks(offer, youtubeRef){
    const wrap=document.createElement('div');
    wrap.className='bundle-action-stack';

    if(offer.price===0 && offer.downloadUrl){
      const preview=document.createElement('a');
      preview.className='bundle-link';
      preview.href=offer.downloadUrl;
      preview.target='_blank';
      preview.rel='noopener noreferrer';
      preview.textContent='Direkt prüfen';
      wrap.append(preview);

      const download=document.createElement('a');
      download.className='bundle-link';
      download.href=offer.downloadUrl;
      download.target='_blank';
      download.rel='noopener noreferrer';
      download.setAttribute('download','');
      download.textContent='Download';
      wrap.append(download);
    }else{
      const offerLink=document.createElement('a');
      offerLink.className='bundle-link';
      offerLink.href=offer.sourcePage || offer.downloadUrl;
      offerLink.target='_blank';
      offerLink.rel='noopener noreferrer';
      offerLink.textContent='Angebot';
      wrap.append(offerLink);
    }

    if(youtubeRef?.found && youtubeRef.videoUrl){
      const yt=document.createElement('a');
      yt.className='bundle-youtube-link';
      yt.href=youtubeRef.videoUrl;
      yt.target='_blank';
      yt.rel='noopener noreferrer';
      yt.textContent='YouTube prüfen';
      wrap.append(yt);
    }else if(youtubeRef?.searchUrl){
      const yt=document.createElement('a');
      yt.className='bundle-youtube-link';
      yt.href=youtubeRef.searchUrl;
      yt.target='_blank';
      yt.rel='noopener noreferrer';
      yt.textContent='YouTube suchen';
      wrap.append(yt);
    }
    return wrap;
  }

  function renderBundles(bundles, missing=[], failed=[]){
    resultsBox.innerHTML='';
    for(const bundle of bundles){
      const node=bundleTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.bundle-rank').textContent=`BUNDLE ${bundle.rank}`;
      node.querySelector('.bundle-title').textContent=`${bundle.items.length} Titel komplett`;
      node.querySelector('.bundle-subtitle').textContent=`Ø Trefferqualität ${Math.round(bundle.averageScore*100)} % · Quellen dürfen gemischt sein`;
      node.querySelector('.bundle-total').textContent=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(bundle.total);
      const box=node.querySelector('.bundle-items');

      for(const item of bundle.items){
        const row=document.createElement('div');
        row.className='bundle-item';
        const text=document.createElement('div');
        const req=document.createElement('div');
        req.className='bundle-request';
        req.textContent=`Gesucht: ${item.request.title} – ${item.request.artist}`;
        const match=document.createElement('div');
        match.className='bundle-match';
        match.textContent=`${item.offer.title || item.request.title} – ${item.offer.artist || item.request.artist}`;
        const provider=document.createElement('div');
        provider.className='bundle-provider';
        provider.textContent=`${item.offer.source} · Treffer ${Math.round((item.offer.score||0)*100)} %${item.offer.license ? ` · ${item.offer.license}` : ''}`;
        text.append(req,match,provider);

        const side=document.createElement('div');
        side.className='bundle-item-side';
        const price=document.createElement('div');
        price.className='bundle-item-price';
        price.textContent=formatPrice(item.offer);
        side.append(price,makeBundleLinks(item.offer,item.request.youtubeReference));
        row.append(text,side);
        box.appendChild(row);
      }
      resultsBox.appendChild(node);
    }

    if(missing.length){
      const warning=document.createElement('div');
      warning.className='bundle-warning';
      warning.textContent=`Kein vollständiges Bundle möglich. Ohne passendes Angebot: ${missing.map(x=>`${x.title} – ${x.artist}`).join('; ')}`;
      resultsBox.prepend(warning);
    }
    if(failed.length){
      const warning=document.createElement('div');
      warning.className='bundle-warning';
      warning.textContent=`Zeitweise nicht erreichbare Quellen: ${[...new Set(failed)].join(', ')}.`;
      resultsBox.appendChild(warning);
    }
  }

  async function runSingleSearch(){
    const wantedTitle=titleInput.value.trim();
    const wantedArtist=artistInput.value.trim();
    if(!wantedTitle || !wantedArtist){
      setStatus('Bitte Titel und Interpret angeben.');
      return;
    }

    setStatus('Suche kostenlose und kostenpflichtige Angebote sowie eine YouTube-Prüfreferenz …');
    const [result,rawYoutubeReference]=await Promise.all([
      collectOffers(wantedTitle,wantedArtist,{compact:false,headerChecks:MAX_HEADER_CHECKS}),
      searchYouTubeReference(wantedTitle,wantedArtist)
    ]);
    const youtubeReference=applyCanonicalYouTubeSearch(
      rawYoutubeReference,
      result.offers,
      wantedTitle,
      wantedArtist
    );
    renderYouTubeReference(
      youtubeReference,
      youtubeReference.canonicalTitle || wantedTitle,
      youtubeReference.canonicalArtist || wantedArtist
    );
    let all=result.offers.slice(0,MAX_RESULTS);
    if(!all.length){
      setStatus(result.failed.length
        ? `Kein passendes Download-/Kaufangebot gefunden. Nicht erreichbare Quelle(n): ${result.failed.join(', ')}.`
        : 'Kein passendes Download-/Kaufangebot gefunden. Die YouTube-Prüfreferenz bleibt separat verfügbar.');
      return;
    }
    render(all);
    const suffix=result.failed.length?` · ${result.failed.join(', ')} war nicht erreichbar.`:'';
    setStatus(`${all.length} günstigste${all.length===1?'r':''} passende${all.length===1?'r':''} Treffer angezeigt.${suffix}`);
  }

  async function runListSearch(){
    const parsed=BundleCore.parseTrackList(trackListInput.value);
    if(parsed.invalid.length){
      setStatus(`Bitte Zeile ${parsed.invalid[0].line} korrigieren. Format: Titel | Interpret`);
      return;
    }
    if(!parsed.tracks.length){
      setStatus('Bitte mindestens einen Titel eintragen. Format: Titel | Interpret');
      return;
    }

    const entries=[];
    const missing=[];
    const failed=[];
    for(let i=0;i<parsed.tracks.length;i++){
      const req=parsed.tracks[i];
      setStatus(`Suche Titel ${i+1}/${parsed.tracks.length}: ${req.title} – ${req.artist} …`);
      const [result,rawYoutubeReference]=await Promise.all([
        collectOffers(req.title,req.artist,{compact:true,headerChecks:2}),
        searchYouTubeReference(req.title,req.artist)
      ]);
      req.youtubeReference=applyCanonicalYouTubeSearch(
        rawYoutubeReference,
        result.offers,
        req.title,
        req.artist
      );
      failed.push(...result.failed);
      const offers=result.offers.slice(0,MAX_OFFERS_PER_BUNDLE_TRACK);
      if(!offers.length) missing.push(req);
      entries.push({request:req,offers});
      // Keep public anonymous services friendly and reduce burst traffic on long lists.
      if(i<parsed.tracks.length-1) await sleep(250);
    }

    if(missing.length){
      renderBundles([],missing,failed);
      setStatus(`Für ${missing.length} von ${parsed.tracks.length} Titeln wurde kein passendes Angebot gefunden; deshalb ist noch kein vollständiger Bundlepreis möglich.`);
      return;
    }

    const bundles=BundleCore.buildTopBundles(entries,MAX_BUNDLES,MAX_OFFERS_PER_BUNDLE_TRACK);
    renderBundles(bundles,[],failed);
    const duplicateNote=parsed.duplicates.length?` ${parsed.duplicates.length} doppelte Zeile${parsed.duplicates.length===1?' wurde':'n wurden'} nur einmal berücksichtigt.`:'';
    setStatus(`${bundles.length} günstigste vollständige Bundle${bundles.length===1?'':'s'} für ${parsed.tracks.length} Titel gefunden.${duplicateNote}`);
  }

  async function runAdvancedSearch(){
    const query=advancedQueryInput.value.trim();
    if(!query){
      setStatus(advancedKind==='artist-titles'?'Bitte einen Interpreten angeben.':'Bitte einen Titel angeben.');
      return;
    }
    const label=advancedKind==='artist-titles'?'Titel':'Interpreten';
    setStatus(`Erweiterte Suche: ermittle ${label} aus allen eingebundenen Quellen …`);
    const result=await runAdvancedDiscovery(advancedKind,query);
    if(!result.items.length){
      renderDiscovery([],advancedKind,query,result.failed);
      setStatus(`Keine passenden ${label} gefunden.${result.failed.length?' Einige Quellen waren nicht erreichbar.':''}`);
      return;
    }
    renderDiscovery(result.items,advancedKind,query,result.failed);
    setStatus(`${result.items.length} unterschiedliche ${label} gefunden.${result.failed.length?' Einige Quellen waren nicht erreichbar; die Liste kann unvollständig sein.':''}`);
  }

  async function runSearch(){
    if(!navigator.onLine){
      setStatus('Keine Internetverbindung. Der Musikfinder ist die einzige Online-App der Sammlung.');
      return;
    }
    searchBtn.disabled=true;
    singleModeBtn.disabled=true;
    listModeBtn.disabled=true;
    advancedModeBtn.disabled=true;
    resultsBox.innerHTML='';
    clearYouTubeReference();
    try{
      if(searchMode==='list') await runListSearch();
      else if(searchMode==='advanced') await runAdvancedSearch();
      else await runSingleSearch();
    }catch(err){
      console.error(err);
      setStatus('Die Suche konnte nicht abgeschlossen werden. Bitte Internetverbindung prüfen und später erneut versuchen.');
    }finally{
      searchBtn.disabled=false;
      singleModeBtn.disabled=false;
      listModeBtn.disabled=false;
      advancedModeBtn.disabled=false;
    }
  }

  singleModeBtn.addEventListener('click',()=>setSearchMode('single'));
  listModeBtn.addEventListener('click',()=>setSearchMode('list'));
  advancedModeBtn.addEventListener('click',()=>setSearchMode('advanced'));
  advancedTitleBtn.addEventListener('click',()=>setAdvancedKind('title-artists'));
  advancedArtistBtn.addEventListener('click',()=>setAdvancedKind('artist-titles'));
  searchBtn.addEventListener('click',runSearch);
  [titleInput,artistInput].forEach(el=>el.addEventListener('keydown',e=>{
    if(e.key==='Enter') runSearch();
  }));
  trackListInput.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey) && e.key==='Enter') runSearch();
  });
  advancedQueryInput.addEventListener('keydown',e=>{
    if(e.key==='Enter') runSearch();
  });
  setAdvancedKind('title-artists');
  setSearchMode('single');
})();
