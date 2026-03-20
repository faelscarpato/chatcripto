export function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Carregando ChatCripto">
      <div className="splash-screen__brand">
        <div className="splash-screen__logo-wrap" aria-hidden="true">
          <div className="splash-screen__logo-glow" />
          <img src="/chatcripto-logo.png" alt="" className="splash-screen__logo" />
        </div>

        <h1 className="splash-screen__title">
         
        </h1>

        <div className="splash-screen__tagline">
          <span className="splash-screen__line" aria-hidden="true" />
          <p>Mensagens seguras com expiracao por sala</p>
          <span className="splash-screen__line" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
