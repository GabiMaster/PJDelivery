export const AUTH_STORAGE_KEY='pjDeliveryAuth';
export const REFRESH_MARGIN_MS=60_000;

export function loadAuthSession(storage=localStorage){
  try{const value=JSON.parse(storage.getItem(AUTH_STORAGE_KEY));return value?.idToken&&value?.refreshToken&&Number.isFinite(value?.expiresAt)?value:null}catch{return null}
}

export function saveAuthSession(data,storage=localStorage,now=Date.now()){
  const session={idToken:data.idToken,refreshToken:data.refreshToken,expiresAt:now+(Number(data.expiresIn)||3600)*1000};
  storage.setItem(AUTH_STORAGE_KEY,JSON.stringify(session));return session;
}

export function clearAuthSession(storage=localStorage){storage.removeItem(AUTH_STORAGE_KEY)}
export function shouldRefreshToken(session,now=Date.now()){return !session||session.expiresAt-now<=REFRESH_MARGIN_MS}
