// Server-safe: the inline script that applies the saved theme before first paint (so there is no flash of the wrong theme).
// Dark is the default across the learning apps; light is opt-in.
export const THEME_KEY = "rag30-theme";

export const THEME_SCRIPT = `(function(){try{var d=localStorage.getItem('${THEME_KEY}')!=='light';var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark'}})()`;
