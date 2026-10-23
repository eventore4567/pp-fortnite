import test from 'node:test';
import assert from 'node:assert/strict';
import { createEpicAuthorizationUrl } from '../src/epic-auth.js';

test('Epic OAuth exige des identifiants privés et une identité Discord valide', () => {
  const saved={clientId:process.env.EPIC_CLIENT_ID,secret:process.env.EPIC_CLIENT_SECRET};
  delete process.env.EPIC_CLIENT_ID;delete process.env.EPIC_CLIENT_SECRET;
  try {
    assert.throws(()=>createEpicAuthorizationUrl('1563237640655085670'),/EPIC_CLIENT_ID/);
    assert.throws(()=>createEpicAuthorizationUrl('not-a-discord-id'),/Utilisateur Discord invalide/);
  } finally {
    if(saved.clientId===undefined)delete process.env.EPIC_CLIENT_ID;else process.env.EPIC_CLIENT_ID=saved.clientId;
    if(saved.secret===undefined)delete process.env.EPIC_CLIENT_SECRET;else process.env.EPIC_CLIENT_SECRET=saved.secret;
  }
});

test('Epic OAuth utilise une redirection HTTPS et un état aléatoire', () => {
  const keys=['EPIC_CLIENT_ID','EPIC_CLIENT_SECRET','PP_PUBLIC_URL'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    process.env.EPIC_CLIENT_ID='test-client-id';
    process.env.EPIC_CLIENT_SECRET='fake-test-secret';
    process.env.PP_PUBLIC_URL='https://pp-fortnite-production.up.railway.app';
    const first=new URL(createEpicAuthorizationUrl('1563237640655085670'));
    const second=new URL(createEpicAuthorizationUrl('1563237640655085670'));
    assert.equal(first.origin,'https://www.epicgames.com');
    assert.equal(first.pathname,'/id/authorize');
    assert.equal(first.searchParams.get('scope'),'basic_profile');
    assert.equal(first.searchParams.get('response_type'),'code');
    assert.equal(first.searchParams.get('redirect_uri'),'https://pp-fortnite-production.up.railway.app/auth/epic/callback');
    assert.equal(first.searchParams.get('client_id'),'test-client-id');
    assert.notEqual(first.searchParams.get('state'),second.searchParams.get('state'));
    assert.ok(first.searchParams.get('state').length>=32);
    assert.equal(first.toString().includes('fake-test-secret'),false);
  } finally {
    for(const key of keys) {
      if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];
    }
  }
});
