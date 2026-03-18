export function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Carregando ChatCripto">
      <div className="splash-screen__brand">
        <div className="splash-screen__logo-wrap" aria-hidden="true">
          <div className="splash-screen__logo-glow" />
          <img src="/chatcripto-logo.png" alt="" className="splash-screen__logo" />
        </div>

        <h1 className="splash-screen__title">
          Chat<span className="splash-screen__accent">Cripto</span>
        </h1>

        <div className="splash-screen__tagline">
          <span className="splash-screen__line" aria-hidden="true" />
          <p>Mensagens seguras que desaparecem em 20 minutos</p>
          <span className="splash-screen__line" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
