// FARUKH PRINT staging: public JWKS + short-lived signed JWT for a future Neon external-auth Data API.
// PRIVATE key lives only in Render environment. This module never transmits it to the browser.
import crypto from 'node:crypto';
export const kid='farukh-print-20261115-v1';
export const jwk={kty:'OKP',crv:'Ed25519',x:'JQN_wblAj8vaKhX0LQ4tyAAZ6_uzIgMaECnillW2nVM',kid,use:'sig',alg:'EdDSA'};
const issuer='https://farukh-print-cloud-test-20261115.onrender.com';
const audience='farukh-print-cloud';
const owner='084de5c3-1c6a-4ef8-8774-289ed64f8838';
export function jwks(){return {keys:[jwk]}}
function getPrivateKey(){
 const s=process.env.FARUKH_PRINT_JWT_PRIVATE_JWK;
 if(!s)throw Error('FARUKH_PRINT_JWT_PRIVATE_JWK not configured');
 const p=JSON.parse(s);
 if(p.kty!=='OKP'||p.crv!=='Ed25519'||p.x!==jwk.x)throw Error('Private JWT key does not match configured public JWKS');
 return crypto.createPrivateKey({key:p,format:'jwk'});
}
export function signOwnerJWT(){
 const now=Math.floor(Date.now()/1000);
 const header={typ:'JWT',alg:'EdDSA',kid};
 const payload={iss:issuer,aud:audience,sub:owner,role:'authenticated',email_verified:true,iat:now,nbf:now-5,exp:now+180};
 const data=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
 const signature=crypto.sign(null,Buffer.from(data),getPrivateKey()).toString('base64url');
 return data+'.'+signature;
}
export function selfCheck(){
 const token=signOwnerJWT(),parts=token.split('.');
 const good=crypto.verify(null,Buffer.from(parts[0]+'.'+parts[1]),crypto.createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 return good&&parts.length===3;
}