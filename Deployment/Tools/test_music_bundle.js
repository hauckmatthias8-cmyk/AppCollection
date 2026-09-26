const assert = require('assert');
const core = require('../../Shared/www/music-bundle.js');

let p = core.parseTrackList('1. Song A | Artist A\nSong B;Artist B\nSong C - Artist C\nSong A | Artist A', 20);
assert.strictEqual(p.tracks.length, 3);
assert.strictEqual(p.duplicates.length, 1);
assert.strictEqual(p.invalid.length, 0);
assert.deepStrictEqual(p.tracks.map(x=>[x.title,x.artist]), [
  ['Song A','Artist A'],['Song B','Artist B'],['Song C','Artist C']
]);

p = core.parseTrackList('No separator here\nGood | Artist', 20);
assert.strictEqual(p.tracks.length, 1);
assert.strictEqual(p.invalid.length, 1);
assert.strictEqual(p.invalid[0].line, 1);

const entries = [
  {request:{title:'A',artist:'AA'},offers:[
    {id:'a0',price:0,score:.8},{id:'a1',price:1,score:.95},{id:'a2',price:2,score:.9}
  ]},
  {request:{title:'B',artist:'BB'},offers:[
    {id:'b2',price:2,score:.9},{id:'b5',price:5,score:.99}
  ]}
];
const bundles = core.buildTopBundles(entries,3,8);
assert.deepStrictEqual(bundles.map(x=>x.total), [2,3,4]);
assert.deepStrictEqual(bundles[0].items.map(x=>x.offer.id), ['a0','b2']);
assert.deepStrictEqual(bundles[1].items.map(x=>x.offer.id), ['a1','b2']);
assert.deepStrictEqual(bundles[2].items.map(x=>x.offer.id), ['a2','b2']);
assert.strictEqual(core.buildTopBundles([{request:{},offers:[]}],3,8).length,0);
console.log('Musikfinder-Bundle-Test OK: Listenparser + 3 günstigste vollständige Bundles.');
