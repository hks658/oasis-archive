const {test} = require('node:test');
const assert = require('node:assert/strict');
const {normalize,matches,compare,defaults} = require('../public/archive-filters');

test('combined filters use saved metadata and trim search text', () => {
  const game = normalize({title:'Portal 2',releaseYear:'2011',platforms:[' PC ','PS3'],rating:4,review:'Great'},'games');
  const state = {...defaults(),query:' PORTAL ',year:'2011',platform:'PC',rating:'4',notes:'yes'};
  assert.equal(matches(game,state),true);
  for (const change of [{year:'2012'},{platform:'Switch'},{rating:'5'},{notes:'no'},{query:'Half-Life'}]) {
    assert.equal(matches(game,{...state,...change}),false);
  }
});
test('unknown metadata and legacy movie scores are handled separately', () => {
  const movie = normalize({title:'Old record',rating:95,year:'未知年份'},'movies');
  assert.equal(matches(movie,{...defaults(),year:'unknown',rating:'unrated'}),true);
  assert.equal(matches(movie,{...defaults(),rating:'4'}),false);
  assert.equal(normalize({userRating:4,rating:95},'movies').rating,4);
  assert.deepEqual(normalize({platforms:'PC / PS5'},'wishlist').platforms,['PC','PS5']);
});
test('ascending and descending numeric sorts keep missing values last', () => {
  const records = [normalize({title:'Unknown'},'games'),normalize({title:'A',rating:5,releaseYear:2024},'games'),normalize({title:'B',rating:2,releaseYear:2010},'games')];
  for (const sort of ['rating-desc','year-desc']) assert.deepEqual([...records].sort((a,b)=>compare(a,b,sort)).map(i=>i.title),['A','B','Unknown']);
  for (const sort of ['rating-asc','year-asc']) assert.deepEqual([...records].sort((a,b)=>compare(a,b,sort)).map(i=>i.title),['B','A','Unknown']);
});
test('date and natural title ordering are deterministic', () => {
  const a=normalize({title:'Game 2',createdAt:100},'games'), b=normalize({title:'Game 10',createdAt:200},'games');
  assert.ok(compare(a,b,'newest')>0);
  assert.ok(compare(a,b,'oldest')<0);
  assert.ok(compare(a,b,'title')<0);
});
